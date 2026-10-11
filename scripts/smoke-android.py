"""Exercise the installed APK through real Android UI nodes, preserving screenshots."""
import subprocess, time, xml.etree.ElementTree as ET, re
from pathlib import Path

def adb(*args):
    return subprocess.check_output(['adb', *args], text=True)

def nodes():
    adb('shell', 'uiautomator', 'dump', '/sdcard/window.xml')
    return ET.fromstring(adb('shell', 'cat', '/sdcard/window.xml')).iter('node')

def tap(label, optional=False):
    visible_nodes=list(nodes())
    height=int(re.findall(r'\d+x(\d+)', adb('shell','wm','size'))[-1])
    safe_bottom=int(height*.93)
    for n in visible_nodes:
        if n.get('content-desc','').startswith('الرئيسية'):
            b=list(map(int,re.findall(r'\d+',n.get('bounds',''))))
            if len(b)==4 and b[1]>height*.7:safe_bottom=min(safe_bottom,b[1])
    for node in visible_nodes:
        values=[node.get('text',''),node.get('content-desc','')]
        if any(value==label or value.startswith(label+',') for value in values):
            coords=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
            if len(coords)==4 and coords[2]>coords[0] and coords[3]>coords[1] and (coords[1]+coords[3])//2<safe_bottom:
                adb('shell','input','tap',str((coords[0]+coords[2])//2),str((coords[1]+coords[3])//2))
                time.sleep(2)
                return True
    if optional:return False
    raise RuntimeError(f'UI control not found: {label}')

def tap_scroll(label):
    for _ in range(5):
        if tap(label,optional=True):return
        scroll_body()
    raise RuntimeError(f'Control not reachable after scrolling: {label}')

def fill_field(label,value):
    for node in nodes():
        if node.get('class')=='android.widget.EditText' and node.get('content-desc')==label:
            coords=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
            adb('shell','input','tap',str((coords[0]+coords[2])//2),str((coords[1]+coords[3])//2))
            time.sleep(1);adb('shell','input','text',value);time.sleep(.5);adb('shell','input','keyevent','4');time.sleep(.5)
            return
    raise RuntimeError(f'Input not found: {label}')

def screenshot(name):
    adb('shell','screencap','-p',f'/sdcard/{name}.png')
    adb('pull',f'/sdcard/{name}.png',f'smoke/{name}.png')
    adb('shell','uiautomator','dump','/sdcard/window.xml')
    adb('pull','/sdcard/window.xml',f'smoke/{name}.xml')

def scroll_body(down=True):
    size = list(map(int, re.findall(r'(\d+)x(\d+)', adb('shell','wm','size'))[-1]))
    width, height = size
    start, end = (0.72, 0.36) if down else (0.36, 0.72)
    adb('shell','input','swipe',str(width//2),str(int(height*start)),
        str(width//2),str(int(height*end)),'400')
    time.sleep(1)

adb('shell','settings','put','secure','show_ime_with_hard_keyboard','1')
time.sleep(12)
tap('تخطي',optional=True)
tap('مش دلوقتي',optional=True)
tap('تخطي',optional=True)
assert any(n.get('text')=='مصروفك تحت السيطرة' for n in nodes()), 'Home not ready'
screenshot('home')
# On short screens the manual action starts below the fixed tab bar.
# Bring it into the visible scroll area before tapping its text node.
scroll_body()
tap('إضافة مصروف يدويًا')
screenshot('expense-form-open')
fields=[n for n in nodes() if n.get('class')=='android.widget.EditText']
assert len(fields)>=2, 'Expense form missing'
for index,value in enumerate(['12.50','QA_coffee']):
    # The keyboard moves the modal: resolve fresh bounds for each field.
    fields=[n for n in nodes() if n.get('class')=='android.widget.EditText' and n.get('package')=='com.hossmoney.app']
    field=fields[index]
    coords=list(map(int,re.findall(r'\d+',field.get('bounds',''))))
    adb('shell','input','tap',str((coords[0]+coords[2])//2),str((coords[1]+coords[3])//2))
    time.sleep(1)
    adb('shell','input','text',value)
    time.sleep(0.5)
    adb('shell','input','keyevent','4')
    time.sleep(0.5)
    entered=[n for n in nodes() if n.get('class')=='android.widget.EditText' and n.get('package')=='com.hossmoney.app']
    assert entered[index].get('text')==value, f'Incorrect field input: {entered[index].get("text")}'
time.sleep(1)
screenshot('expense-form')
tap_scroll('حفظ')
time.sleep(3)
scroll_body(down=False)
assert any('12.50' in n.get('text','') for n in nodes()), 'Home total did not update'
screenshot('home-with-expense')
for label,name in [('الإحصائيات','stats'),('المصاريف','expenses'),('الإعدادات','admin')]:
    tap(label)
    screenshot(name)
    if name=='stats':
        scroll_body(); screenshot('stats-categories'); scroll_body(); screenshot('stats-comparison'); scroll_body(); screenshot('stats-comparison-full')
for label,name in [('الحسابات والأرصدة','accounts'),('الدخل','income'),('الديون والسداد','debts'),('المصاريف المتكررة','recurring')]:
    tap(label)
    screenshot(name)
    if name=='income':
        tap('إضافة دخل')
        fill_field('الوصف','QA_salary')
        fill_field('المبلغ','100')
        tap_scroll('حفظ')
        assert any('QA_salary' in n.get('text','') for n in nodes()),'Income not saved'
        screenshot('income-saved')
    tap('رجوع')
tap_scroll('المظهر والأمان')
screenshot('settings')
# First switch in preferences is the theme toggle.
switches=[n for n in nodes() if n.get('class')=='android.widget.Switch']
for _ in range(4):
    if switches:break
    scroll_body()
    switches=[n for n in nodes() if n.get('class')=='android.widget.Switch']
assert switches, 'Theme switch not reached'
if switches:
    coords=list(map(int,re.findall(r'\d+',switches[0].get('bounds',''))))
    adb('shell','input','tap',str((coords[0]+coords[2])//2),str((coords[1]+coords[3])//2))
    time.sleep(2)
    screenshot('settings-light')
adb('shell','am','force-stop','com.hossmoney.app')
adb('shell','am','start','-W','-n','com.hossmoney.app/.MainActivity')
time.sleep(8)
assert any('12.50' in n.get('text','') for n in nodes()), 'Expense did not survive restart'
screenshot('restart-persistence')
Path('smoke/result.txt').write_text('PASS: cold launch, manual expense and income, refreshed total, four tabs and financial pages, dark/light switch, restart persistence.\n')

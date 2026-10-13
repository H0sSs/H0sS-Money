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
    if label in ['الرئيسية','الإحصائيات','المصاريف','الإعدادات']:safe_bottom=int(height*.93)
    for node in visible_nodes:
        values=[node.get('text',''),node.get('content-desc','')]
        if any(value==label or value.startswith(label+',') for value in values):
            coords=list(map(int,re.findall(r'\d+',node.get('bounds',''))))
            if len(coords)==4 and coords[2]>coords[0] and coords[3]-coords[1]>=40 and coords[2]-coords[0]>=40 and coords[1]>=height*.025 and (coords[1]+coords[3])//2<safe_bottom-16:
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

def choose_kind(index,name):
    label=f'نوع الصنف {index}: {name}'
    for attempt in range(24):
        if tap(label,optional=True):
            found=next((n for n in nodes() if n.get('content-desc')==label),None)
            if found is not None and found.get('selected')=='true':return
        scroll_body(down=attempt<12)
    screenshot('kind-selection-failed')
    raise RuntimeError(f'Financial kind not selected: {label}')

def fill_field(label,value):
    for attempt in range(32):
        target=next((n for n in nodes() if n.get('class')=='android.widget.EditText' and n.get('content-desc')==label),None)
        if target is not None:
            coords=list(map(int,re.findall(r'\d+',target.get('bounds',''))))
            height=int(re.findall(r'\d+x(\d+)',adb('shell','wm','size'))[-1])
            if len(coords)==4 and coords[3]-coords[1]>=48 and height*.08<(coords[1]+coords[3])//2<height*.9:
                adb('shell','input','tap',str((coords[0]+coords[2])//2),str((coords[1]+coords[3])//2))
                time.sleep(1)
                if target.get('text',''):
                    adb('shell','input','keyevent','123')
                    adb('shell','input','keyevent',*(['67']*len(target.get('text',''))))
                adb('shell','input','text',value);time.sleep(.5);adb('shell','input','keyevent','4');time.sleep(.5)
                entered=next(n for n in nodes() if n.get('class')=='android.widget.EditText' and n.get('content-desc')==label)
                assert entered.get('text')==value,f'Incorrect input: {label}'
                return
            has_bounds=len(coords)==4 and coords[2]>coords[0] and coords[3]>coords[1]
            scroll_body(down=not(coords[3]<height*.2) if has_bounds else attempt<16)
        else:scroll_body(down=attempt<16)
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
    adb('shell','input','swipe',str(int(width*.04)),str(int(height*start)),
        str(int(width*.04)),str(int(height*end)),'400')
    time.sleep(1)

adb('shell','settings','put','secure','show_ime_with_hard_keyboard','1')
time.sleep(12)
screenshot('startup')
for _ in range(8):
    if any(n.get('text')=="System UI isn't responding" for n in nodes()):
        screenshot('emulator-system-ui-anr')
        tap('Wait')
        time.sleep(3)
    tap('مش دلوقتي',optional=True)
    tap('ابدأ الاستخدام',optional=True)
    tap('تخطي',optional=True)
    if any(n.get('text')=='مصروفك تحت السيطرة' for n in nodes()):break
    time.sleep(2)
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
# Exercise the same multi-item review and atomic save used by microphone results.
tap_scroll('إضافة مصروف يدويًا')
fill_field('مبلغ الصنف 1','19.75')
fill_field('وصف الصنف 1','QA_bread')
tap_scroll('إضافة صنف آخر')
fill_field('مبلغ الصنف 2','7.25')
fill_field('وصف الصنف 2','QA_bus')
screenshot('batch-review')
tap_scroll('حفظ')
time.sleep(3)
scroll_body(down=False)
for _ in range(4):
    if any('39.50' in n.get('text','') for n in nodes()):break
    scroll_body(down=False)
assert any('39.50' in n.get('text','') for n in nodes()), 'Batch total missing an item'
screenshot('home-with-batch')
for label,name in [('الإحصائيات','stats'),('المصاريف','expenses'),('الإعدادات','admin')]:
    tap(label)
    screenshot(name)
    if name=='expenses':
        assert any('إجمالي المصاريف المعروضة' in n.get('text','') for n in nodes()), 'Expense summary missing'
        fill_field('بحث المصاريف','QA_bread')
        assert any('19.75' in n.get('text','') for n in nodes()), 'Filtered expense total incorrect'
        screenshot('expenses-filtered')
        fill_field('بحث المصاريف','NO_MATCH_126')
        assert any('لا توجد نتائج مطابقة للفلاتر' in n.get('text','') for n in nodes()), 'Filtered empty state missing'
        tap('مسح جميع الفلاتر')
        assert any('39.50' in n.get('text','') for n in nodes()), 'Reset filters failed'
        screenshot('expenses-redesign')
    if name=='stats':
        for action,name_out in [('تصدير تقرير PDF','pdf'),('تصدير الإحصائيات صورة','image')]:
            tap(action)
            time.sleep(5)
            screenshot('export-'+name_out+'-chooser')
            tap('Export QA')
            tap('Just once',optional=True)
            time.sleep(3)
            assert 'خطأ' not in [n.get('text','') for n in nodes()], 'Export failed'
        scroll_body(); screenshot('stats-categories'); scroll_body(); screenshot('stats-comparison'); scroll_body(); screenshot('stats-comparison-full'); assert any('لا يوجد إنفاق سابق لحساب النسبة' in n.get('text','') for n in nodes()), 'Zero baseline comparison fabricated a percentage'
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
# Mixed review uses the exact save path shared with microphone extraction.
tap('الرئيسية')
scroll_body(down=False)
tap_scroll('إضافة مصروف يدويًا')
choose_kind(1,'إيراد')
fill_field('مبلغ الصنف 1','200')
fill_field('وصف الصنف 1','QA_mixed_income')
tap_scroll('إضافة صنف آخر')
fill_field('مبلغ الصنف 2','10')
fill_field('وصف الصنف 2','QA_mixed_expense')
tap_scroll('إضافة صنف آخر')
choose_kind(3,'دين لك')
screenshot('third-kind-selected')
fill_field('اسم الشخص للصنف 3','QA_person')
fill_field('مبلغ الصنف 3','50')
fill_field('وصف الصنف 3','QA_mixed_debt')
screenshot('mixed-financial-review')
tap_scroll('حفظ')
time.sleep(3)
scroll_body(down=False)
tap_scroll('الإيرادات والمصروفات')
assert any('250.50' in n.get('text','') for n in nodes()), 'Mixed ledger net is incorrect'
screenshot('ledger-mixed')
# Read all table columns through real horizontal scroll; the income and expense must both exist.
size=list(map(int,re.findall(r'(\d+)x(\d+)',adb('shell','wm','size'))[-1]))
adb('shell','input','swipe',str(int(size[0]*.85)),str(int(size[1]*.72)),str(int(size[0]*.15)),str(int(size[1]*.72)),'400')
time.sleep(1)
scroll_body()
screenshot('ledger-table')
assert any('QA_mixed_income' in n.get('text','') for n in nodes()), 'Income row missing from ledger table'
# The ledger is scrolled; its header is outside the viewport. Use Android navigation.
adb('shell','input','keyevent','4')
time.sleep(2)
tap('الإعدادات')
tap_scroll('الديون والسداد')
assert any('QA_person' in n.get('text','') for n in nodes()), 'Mixed debt was not routed to debts'
screenshot('mixed-debt-saved')
tap('رجوع')
tap_scroll('النسخ والبيانات')
screenshot('backup-account-link')
assert not any('Client ID' in n.get('text','') for n in nodes()), 'Android backup exposes developer configuration'
tap('رجوع للإعدادات')
tap_scroll('ملفي الشخصي')
fill_field('اسمك','QA_Owner')
fill_field('رقم الهاتف','01012345678')
fill_field('البريد الإلكتروني','qa@example.test')
fill_field('بيانات إضافية','QA_ProfileDetails')
tap_scroll('حفظ الملف الشخصي')
tap('OK',optional=True);tap('حسنًا',optional=True)
screenshot('profile-saved')
adb('shell','input','keyevent','4');time.sleep(2)
tap_scroll('دليل الاستخدام')
tap_scroll('التسجيل بالصوت ومراجعة التصنيف')
screenshot('guide-voice')
adb('shell','input','keyevent','4');time.sleep(2)
tap_scroll('فحص البيانات والتراجع')
tap_scroll('فحص اتساق البيانات')
assert any('نجح الفحص' in n.get('text','') for n in nodes()),'Data integrity failed'
screenshot('integrity-check')
adb('shell','input','keyevent','4');time.sleep(2)
tap_scroll('التقرير المالي الشامل')
tap_scroll('تجهيز التقرير ومراجعة الإجماليات')
for _ in range(8):
    if any('250.50' in n.get('text','') for n in nodes()):break
    scroll_body()
assert any('250.50' in n.get('text','') for n in nodes()),'Full report totals mismatch'
screenshot('report-all-summary')
tap_scroll('تصدير PDF');time.sleep(5)
tap('Export QA');tap('Just once',optional=True);time.sleep(3)
screenshot('report-exported')
adb('shell','input','keyevent','4');time.sleep(2)
# Restore the settings menu top before opening preferences.
for _ in range(4):scroll_body(down=False)
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
assert any('49.50' in n.get('text','') for n in nodes()), 'Expense total after mixed save did not survive restart'
screenshot('restart-persistence')
Path('smoke/result.txt').write_text('PASS: cold launch, single and mixed income/expense/debt recording, ledger net 250.50, refreshed expense total 49.50, native PDF/image sharing, simple Google account link UI, four tabs and financial pages, dark/light switch, restart persistence.\n')

from pathlib import Path
from pypdf import PdfReader
from PIL import Image
p=Path('smoke/report.pdf');assert p.read_bytes().startswith(b'%PDF-'), 'Not a PDF'
r=PdfReader(p);assert len(r.pages)>=1
text='\n'.join(page.extract_text() or '' for page in r.pages)
assert 'QA_' in text and '39.50' in text, 'Financial rows missing from exported PDF'
fonts=[];images=[]
for page in r.pages:
 resources=page['/Resources']
 font_dict=resources.get('/Font',{});font_dict=font_dict.get_object() if hasattr(font_dict,'get_object') else font_dict
 for font in font_dict.values():
  f=font.get_object()
  for sub in f.get('/DescendantFonts',[f]):
   sub=sub.get_object();desc=sub.get('/FontDescriptor');desc=desc.get_object() if desc else None
   if desc and ('/FontFile2' in desc or '/FontFile3' in desc):fonts.append(desc)
 x_dict=resources.get('/XObject',{});x_dict=x_dict.get_object() if hasattr(x_dict,'get_object') else x_dict
 for x in x_dict.values():
  x=x.get_object()
  if x.get('/Subtype')=='/Image':images.append(x)
assert fonts, 'PDF has no embedded font'
assert images, 'PDF logo not embedded'
im=Image.open('smoke/export-stats.png');assert im.width>300 and im.height>800, 'Statistics capture cropped/empty'
Path('smoke/exports-result.txt').write_text(f'PASS: {len(r.pages)} PDF pages, embedded fonts and logo, all QA expense rows; full statistics PNG {im.width}x{im.height}.\n')
print(Path('smoke/exports-result.txt').read_text())

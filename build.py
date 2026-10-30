#!/usr/bin/env python3
"""Builds public/index.html (served app) and preview/holo-tutor.html (single-file preview)."""
import pathlib, re
R = pathlib.Path(__file__).parent
body = (R / 'src/body.html').read_text()
css = (R / 'public/style.css').read_text()
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">'

(R / 'public/index.html').write_text(f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07090C">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icon.svg">
<title>Holo Tutor</title>
{FONTS}
<link rel="stylesheet" href="style.css">
</head>
<body data-view="home" data-state="idle">
{body}<script type="module" src="app.js"></script>
</body>
</html>
''')

def strip_module(src):
    src = re.sub(r"^import .*?;\n", "", src, flags=re.M)
    return re.sub(r"^export ", "", src, flags=re.M)

js = '\n'.join(strip_module((p).read_text()) for p in [R/'public/visemes.js', R/'public/face.js', R/'public/lips.js', R/'public/media.js', R/'public/i18n.js', R/'public/tts.js', R/'public/tutor.js', R/'public/prompt.js', R/'public/funprog.js', R/'public/twin.js', R/'preview/brain-preview.js', R/'public/account.js', R/'public/app.js'])
(R / 'preview/holo-tutor.html').write_text(f'''<title>Holo Tutor</title>
<meta name="claude:viewport-fit-sides" content="cover">
{FONTS}
<style>
{css}</style>
{body}<script type="module">
document.body.dataset.view = 'home'; document.body.dataset.state = 'idle';
{js}
</script>
''')
js2 = '\n'.join(strip_module((p).read_text()) for p in [R/'public/visemes.js', R/'public/face.js', R/'public/lips.js', R/'public/media.js', R/'public/i18n.js', R/'public/tts.js', R/'public/tutor.js', R/'public/prompt.js', R/'public/funprog.js', R/'public/twin.js', R/'standalone/brain-direct.js', R/'public/account.js', R/'public/app.js'])
(R / 'standalone/holo-tutor.html').write_text(f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07090C">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Holo Tutor</title>
{FONTS}
<style>
{css}</style>
</head>
<body data-view="home" data-state="idle">
{body}<script type="module">
{js2}
</script>
</body>
</html>
''')
print('built')

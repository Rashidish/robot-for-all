# Fonts for certificates

Noto Sans Regular and Bold (Google, SIL Open Font License 1.1, `OFL.txt`), from the
`@expo-google-fonts/noto-sans` package (0.4.2), cut down to the Latin letters South Africa's
languages use (including Tshivenda's ḓ, ḽ, ṅ, ṋ and ṱ, which the PDF standard fonts can't print)
so each file is about 77 KB:

```
pyftsubset NotoSans_400Regular.ttf --unicodes="U+0020-007E,U+00A0-024F,U+0300-036F,U+1E00-1EFF,U+2010-2027,U+2030-205E,U+20AC" \
  --layout-features='kern' --no-hinting --desubroutinize --output-file=NotoSans-Regular.ttf
```

(the same for Bold). Each certificate then embeds only the letters it uses, so a PDF is about 11 KB.
The OFL allows this; the font name is unchanged because the files are not distributed as fonts.

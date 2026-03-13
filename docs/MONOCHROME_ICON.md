# How to create a themed (monochrome) app icon

Themed icons use a **monochrome** layer: a single-colour shape (white `#FFFFFF`) that the system tints with the user's wallpaper/theme. Right now the app uses a **placeholder** (rounded rectangle) so themed icons show something; replace it with your BTCC logo for the real look.

## Option 1: Android Studio Image Asset Studio (easiest)

1. **File → New → Image Asset**
2. **Icon type:** Launcher Icons (Adaptive and Legacy)
3. **Name:** `ic_launcher`
4. Under **Foreground Layer**, set your `Icon.png` (or the main logo).
5. Under **Legacy** (or in the same wizard), look for **Monochrome** / **Themed icon**.
6. If available, add a **monochrome** image: use a **white-only** version of your logo (white shape on transparent background), same size as foreground (e.g. 432px for xxxhdpi). The tool will write the right XML/PNG.
7. Finish and replace the generated `ic_launcher_monochrome` in `res/drawable` or `res/mipmap-*`.

## Option 2: Export from Figma / Illustrator

1. **Canvas:** 108×108 dp (or 432×432 px for export).
2. **Safe zone:** Keep the logo within the center **66×66 dp** (outer 18 dp on each side can be cropped by masks).
3. **Colour:** Pure white `#FFFFFF` only; background transparent.
4. **Export:** SVG (preferred) or PNG (white on transparent).
5. **Use in Android:**
   - **SVG:** Convert to Android Vector Drawable (e.g. [svg2vector](https://svg2vector.com/) or Android Studio’s Vector Asset import). Copy the `<path android:pathData="..."/>` into `app/src/main/res/drawable/ic_launcher_monochrome.xml`, with `android:fillColor="#FFFFFF"` and `viewportWidth/Height="108"`.
   - **PNG:** Put `ic_launcher_monochrome.png` in `drawable-mdpi` (108px), `drawable-hdpi` (162px), `drawable-xhdpi` (216px), `drawable-xxhdpi` (324px), `drawable-xxxhdpi` (432px). Remove or rename the current `ic_launcher_monochrome.xml` so the PNGs are used.

## Option 3: Trace Icon.png to vector

1. Use a tracer (e.g. [vectorizer.io](https://www.vectorizer.io/), or Figma “Flatten” then outline) on `Icon.png` to get an SVG path.
2. Open the SVG, set the logo fill to white, background to none.
3. Convert the SVG to Android Vector Drawable (same as Option 2, step 5).

## Current file

- **Vector placeholder:** `app/src/main/res/drawable/ic_launcher_monochrome.xml`  
  Replace the `<path android:pathData="..."/>` with your logo path (keep `android:fillColor="#FFFFFF"` and the 108×108 viewport).

## Reference

- [Adaptive icons (Android)](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)  
- Monochrome = one layer, white shape, 108×108 dp, content in the 66×66 dp safe zone.

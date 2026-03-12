# Run configuration: "app"

If you see **Invalid packageName: com.btcchub** or **Activity class {com.btcchub/com.btccfanhub.MainActivity} does not exist**, the IDE is using a cached old package. Do this:

1. **Run → Edit Configurations…** → select **"app"** → click **−** to **delete** it → **Apply** → **OK**.
2. **File → Invalidate Caches…** → **Invalidate and Restart**.
3. After restart: **Build → Clean Project**, then **Build → Rebuild Project**.
4. Use the **"app"** run configuration again (it will be recreated from this folder). Run the app.

The app package is **com.btccfanhub**; after the steps above the launch component will be `com.btccfanhub/.MainActivity`.

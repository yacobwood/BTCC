# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Keep widget classes
-keep class com.btccfanhub.widget.** { *; }

# Keep WorkManager workers — WorkManager stores class names as strings in its
# Room DB and reinstantiates them by name on reboot/update. R8 must not rename.
-keep class com.btccfanhub.worker.** { *; }

# Keep native service classes — RadioPackage/RadioModule are wired into the
# React Native host and loaded via the RN module reflection system. RadioService
# is declared in the manifest. IcyDataSource is used by the ExoPlayer pipeline.
-keep class com.btccfanhub.service.** { *; }

# WorkManager — ensure the ListenableWorker constructor signature is preserved
# (work-runtime-ktx ships consumer rules but be explicit for safety)
-keep public class * extends androidx.work.ListenableWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}

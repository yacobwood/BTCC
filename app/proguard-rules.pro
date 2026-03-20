# Keep WebView JavaScript interfaces (AppScrollTracker etc.)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve source file names and line numbers for Crashlytics stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# SLF4J is a transitive dependency — suppress missing class warning
-dontwarn org.slf4j.**

# Strip debug logs in release
-assumenosideeffects class android.util.Log {
    public static int d(...);
    public static int v(...);
}

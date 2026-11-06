import java.util.Properties

// The Android app as a Trusted Web Activity: the live web app, full screen, under its own icon. It has no code of
// its own, so every web deploy reaches it without a new APK. Signed with the same git-ignored key as :app.
plugins {
    alias(libs.plugins.android.application)
}

val keystoreProperties = Properties().apply {
    rootProject.file("keystore.properties").takeIf { it.exists() }?.inputStream()?.use(::load)
}

android {
    namespace = "com.behlul.liftlog.web"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.behlul.liftlog.web"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }

    signingConfigs {
        if (!keystoreProperties.isEmpty) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }
}

dependencies {
    implementation(libs.androidbrowserhelper)
}

@echo off
setlocal
set "TOOL_ROOT=%~dp0..\..\.android-tools"
for /d %%J in ("%TOOL_ROOT%\jdk-17*") do set "JAVA_HOME=%%~fJ"
if not defined JAVA_HOME (
    echo Java local nao encontrado em .android-tools.
    exit /b 1
)
set "ANDROID_HOME=%TOOL_ROOT%\sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "ANDROID_USER_HOME=%TOOL_ROOT%\android-user"
set "GRADLE_USER_HOME=%TOOL_ROOT%\gradle-home"
pushd "%~dp0"
call gradlew.bat assembleDebug --console=plain --no-daemon
set "BUILD_RESULT=%ERRORLEVEL%"
popd
exit /b %BUILD_RESULT%

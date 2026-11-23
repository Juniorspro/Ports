#!/bin/bash
# Compila JXMod nativo (libjxmod.so) para Android: arm64-v8a y armeabi-v7a, con las páginas de 16 KB (Android 15+).
# Después: python3 -I apk/armar_nativo.py SALIDA.apk --www <carpeta del paquete>
# NDK: $ANDROID_NDK (por defecto /tmp/claude-0/ndk_dl/android-ndk-r27c). Salida en $CARGO_TARGET_DIR/<abi>/release/.
set -euo pipefail
cd "$(dirname "$0")"
NDK=${ANDROID_NDK:-/tmp/claude-0/ndk_dl/android-ndk-r27c}
B=$NDK/toolchains/llvm/prebuilt/linux-x86_64/bin
export CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-/tmp/claude-0/jxm_target}
export CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER=$B/aarch64-linux-android24-clang CC_aarch64_linux_android=$B/aarch64-linux-android24-clang AR_aarch64_linux_android=$B/llvm-ar
export CARGO_TARGET_ARMV7_LINUX_ANDROIDEABI_LINKER=$B/armv7a-linux-androideabi24-clang CC_armv7_linux_androideabi=$B/armv7a-linux-androideabi24-clang AR_armv7_linux_androideabi=$B/llvm-ar
export CARGO_TARGET_AARCH64_LINUX_ANDROID_RUSTFLAGS="-C link-arg=-Wl,-z,max-page-size=16384"
for t in aarch64-linux-android armv7-linux-androideabi; do
  cargo build --release -p jxmod-nativo --lib --target $t
  ls -la "$CARGO_TARGET_DIR/$t/release/libjxmod.so"
done

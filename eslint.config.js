import antfu from '@antfu/eslint-config'

export default antfu({
  react: true,
  typescript: true,
  ignores: [
    '.gstack',
    'dist',
    'src-tauri/gen',
    'src-tauri/target',
    'src-tauri/Cargo.lock',
    'src-tauri/Cargo.toml',
    'tsconfig*.json',
  ],
})

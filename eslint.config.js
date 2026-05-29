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
}, {
  files: ['src/components/app/**/*.{ts,tsx}', 'src/components/ui/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        '@tauri-apps/*',
        '@/auth/*',
        '@/lib/sync-adapters/*',
      ],
    }],
  },
})

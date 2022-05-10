module.exports = {
  root: true,
  extends: [
    require.resolve('@gera2ld/plaid/eslint')
  ],
  settings: {
    'import/resolver': {
      'babel-module': {},
    },
    react: {
      pragma: 'VM',
    },
  },
  globals: {
    VM: true,
  },
  rules: {
    indentSize: 4
  }
};

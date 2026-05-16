import { resolve } from 'path';

export default {
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        login: resolve(import.meta.dirname, 'login.html'),
        signup: resolve(import.meta.dirname, 'signup.html'),
        forgotPassword: resolve(import.meta.dirname, 'forgot-password.html'),
        resetPassword: resolve(import.meta.dirname, 'reset-password.html'),
      },
    },
  },
};

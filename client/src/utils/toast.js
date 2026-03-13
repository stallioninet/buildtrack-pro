import toast from 'react-hot-toast';

export function showError(message) {
  toast.error(message, { duration: 4000 });
}

export function showSuccess(message) {
  toast.success(message, { duration: 3000 });
}

export function showWarning(message) {
  toast(message, { icon: '⚠️', duration: 3500 });
}

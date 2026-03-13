import { useState, useCallback } from 'react';

// Simple client-side form validation hook
export default function useFormValidation(rules) {
  const [errors, setErrors] = useState({});

  const validate = useCallback((form) => {
    const newErrors = {};

    for (const [field, fieldRules] of Object.entries(rules)) {
      const value = form[field];

      if (fieldRules.required && (!value || (typeof value === 'string' && !value.trim()))) {
        newErrors[field] = fieldRules.message || `${fieldRules.label || field} is required`;
        continue;
      }

      if (value && fieldRules.minLength && typeof value === 'string' && value.trim().length < fieldRules.minLength) {
        newErrors[field] = `${fieldRules.label || field} must be at least ${fieldRules.minLength} characters`;
        continue;
      }

      if (value && fieldRules.maxLength && typeof value === 'string' && value.length > fieldRules.maxLength) {
        newErrors[field] = `${fieldRules.label || field} must be at most ${fieldRules.maxLength} characters`;
        continue;
      }

      if (value && fieldRules.min !== undefined && Number(value) < fieldRules.min) {
        newErrors[field] = `${fieldRules.label || field} must be at least ${fieldRules.min}`;
        continue;
      }

      if (value && fieldRules.pattern && !fieldRules.pattern.test(value)) {
        newErrors[field] = fieldRules.message || `${fieldRules.label || field} is invalid`;
        continue;
      }

      if (fieldRules.custom && typeof fieldRules.custom === 'function') {
        const customError = fieldRules.custom(value, form);
        if (customError) {
          newErrors[field] = customError;
          continue;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [rules]);

  const clearErrors = useCallback(() => setErrors({}), []);
  const clearError = useCallback((field) => setErrors(prev => { const next = { ...prev }; delete next[field]; return next; }), []);

  return { errors, validate, clearErrors, clearError };
}

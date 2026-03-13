import { useState, useCallback } from 'react';

/**
 * Manages multiple modal states with a single hook.
 * Replaces patterns like:
 *   const [showCreate, setShowCreate] = useState(false);
 *   const [editItem, setEditItem] = useState(null);
 *   const [deleteItem, setDeleteItem] = useState(null);
 *
 * With:
 *   const modal = useModal();
 *   modal.open('create')
 *   modal.open('edit', task)
 *   modal.isOpen('create') // true/false
 *   modal.data('edit') // task object
 *   modal.close('edit')
 */
export function useModal() {
  const [modals, setModals] = useState({});

  const open = useCallback((name, data = true) => {
    setModals(prev => ({ ...prev, [name]: data }));
  }, []);

  const close = useCallback((name) => {
    setModals(prev => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const closeAll = useCallback(() => {
    setModals({});
  }, []);

  const isOpen = useCallback((name) => {
    return name in modals;
  }, [modals]);

  const data = useCallback((name) => {
    return modals[name] === true ? null : modals[name];
  }, [modals]);

  const toggle = useCallback((name, data = true) => {
    setModals(prev => {
      if (name in prev) {
        const next = { ...prev };
        delete next[name];
        return next;
      }
      return { ...prev, [name]: data };
    });
  }, []);

  return { open, close, closeAll, isOpen, data, toggle };
}

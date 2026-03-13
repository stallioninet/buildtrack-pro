import { useState, useCallback } from 'react';
import { showError } from '../utils/toast';

// Hook for optimistic list updates
export function useOptimisticList(initialItems = []) {
  const [items, setItems] = useState(initialItems);

  const optimisticUpdate = useCallback(async (updatedItems, apiCall, rollbackItems) => {
    setItems(updatedItems);
    try {
      await apiCall();
    } catch (err) {
      setItems(rollbackItems);
      showError(err.message || 'Operation failed, changes reverted');
    }
  }, []);

  const optimisticRemove = useCallback(async (id, apiCall) => {
    setItems(prev => {
      const rollback = [...prev];
      const filtered = prev.filter(item => item.id !== id);
      apiCall().catch(err => {
        setItems(rollback);
        showError(err.message || 'Delete failed, item restored');
      });
      return filtered;
    });
  }, []);

  const optimisticAdd = useCallback(async (tempItem, apiCall, onSuccess) => {
    setItems(prev => [...prev, tempItem]);
    try {
      const result = await apiCall();
      // Replace temp item with real one
      setItems(prev => prev.map(item => item.id === tempItem.id ? result : item));
      if (onSuccess) onSuccess(result);
    } catch (err) {
      setItems(prev => prev.filter(item => item.id !== tempItem.id));
      showError(err.message || 'Add failed');
    }
  }, []);

  return { items, setItems, optimisticUpdate, optimisticRemove, optimisticAdd };
}

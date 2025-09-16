import { useState, useEffect } from 'react';

export function useChromeStorage<T extends Record<string, any>>(
  defaultValue: T
): [
  T,
  (value: Partial<T>) => Promise<void>,
  boolean
] {
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadStorage = async () => {
      try {
        const result = await chrome.storage.local.get(['settings']);
        const stored = result.settings || defaultValue;
        setValue({ ...defaultValue, ...stored });
        setLoaded(true);
      } catch (error) {
        console.error('Error loading chrome storage:', error);
        setValue(defaultValue);
        setLoaded(true);
      }
    };

    loadStorage();

    // Listen for storage changes
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.settings) {
        setValue({ ...defaultValue, ...changes.settings.newValue });
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [defaultValue]);

  const updateValue = async (newValue: Partial<T>) => {
    try {
      const updatedValue = { ...value, ...newValue };
      await chrome.storage.local.set({ settings: updatedValue });
      setValue(updatedValue);
    } catch (error) {
      console.error('Error updating chrome storage:', error);
    }
  };

  return [value, updateValue, loaded];
}
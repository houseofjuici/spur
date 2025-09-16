import React, { useState, useEffect } from 'react';
import { useChromeStorage } from '../hooks/useChromeStorage';

interface Settings {
  enableNotifications: boolean;
  autoSync: boolean;
  darkMode: boolean;
  maxHistorySize: number;
  syncInterval: number;
  enableVoiceCommands: boolean;
  gmailIntegration: boolean;
  dataRetentionDays: number;
  apiKey?: string;
  syncUrl?: string;
}

const Options: React.FC = () => {
  const [settings, setSettings, settingsLoaded] = useChromeStorage({
    enableNotifications: true,
    autoSync: true,
    darkMode: false,
    maxHistorySize: 100,
    syncInterval: 300000,
    enableVoiceCommands: true,
    gmailIntegration: false,
    dataRetentionDays: 365,
    apiKey: '',
    syncUrl: ''
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [testResults, setTestResults] = useState<{
    connection: boolean;
    gmail: boolean;
    storage: boolean;
  }>({ connection: false, gmail: false, storage: false });
  const [isTesting, setIsTesting] = useState(false);
  const [exportData, setExportData] = useState<string>('');
  const [importData, setImportData] = useState<string>('');

  useEffect(() => {
    setHasChanges(false);
  }, [settings]);

  const handleSettingChange = (key: keyof Settings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      await setSettings(settings);
      setHasChanges(false);
      
      // Show success notification
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Spur Settings',
        message: 'Settings saved successfully!'
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleTestConnections = async () => {
    setIsTesting(true);
    setTestResults({ connection: false, gmail: false, storage: false });
    
    try {
      // Test storage access
      await chrome.storage.local.set({ test: Date.now() });
      setTestResults(prev => ({ ...prev, storage: true }));
      
      // Test API connection (if configured)
      if (settings.syncUrl && settings.apiKey) {
        try {
          const response = await fetch(`${settings.syncUrl}/health`, {
            headers: { 'Authorization': `Bearer ${settings.apiKey}` }
          });
          if (response.ok) {
            setTestResults(prev => ({ ...prev, connection: true }));
          }
        } catch (error) {
          console.error('API connection test failed:', error);
        }
      }
      
      // Test Gmail access (if enabled)
      if (settings.gmailIntegration) {
        try {
          // This would test Gmail OAuth tokens
          const result = await chrome.storage.local.get(['gmailTokens']);
          if (result.gmailTokens) {
            setTestResults(prev => ({ ...prev, gmail: true }));
          }
        } catch (error) {
          console.error('Gmail test failed:', error);
        }
      }
    } catch (error) {
      console.error('Connection tests failed:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const handleExportData = async () => {
    try {
      const result = await chrome.storage.local.get(null);
      const exportObj = {
        settings: result.settings,
        memories: result.memories || [],
        exportDate: new Date().toISOString(),
        version: chrome.runtime.getManifest().version
      };
      setExportData(JSON.stringify(exportObj, null, 2));
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImportData = async () => {
    if (!importData.trim()) return;
    
    try {
      const importObj = JSON.parse(importData);
      
      // Validate import data structure
      if (importObj.settings) {
        await setSettings(importObj.settings);
      }
      
      if (importObj.memories && Array.isArray(importObj.memories)) {
        await chrome.storage.local.set({ memories: importObj.memories });
      }
      
      setImportData('');
      
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Spur Settings',
        message: 'Data imported successfully!'
      });
    } catch (error) {
      console.error('Import failed:', error);
      alert('Invalid import data format');
    }
  };

  const handleClearAllData = async () => {
    if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      return;
    }
    
    try {
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();
      
      // Reset to defaults
      await setSettings({
        enableNotifications: true,
        autoSync: true,
        darkMode: false,
        maxHistorySize: 100,
        syncInterval: 300000,
        enableVoiceCommands: true,
        gmailIntegration: false,
        dataRetentionDays: 365,
        apiKey: '',
        syncUrl: ''
      });
      
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Spur Settings',
        message: 'All data cleared successfully!'
      });
    } catch (error) {
      console.error('Clear data failed:', error);
    }
  };

  return (
    <div className="options-container">
      <div className="options-header">
        <div className="header-content">
          <img src="icons/icon-64.png" alt="Spur" className="header-icon" />
          <div>
            <h1>Spur Settings</h1>
            <p>Configure your personal productivity companion</p>
          </div>
        </div>
        <div className="header-actions">
          {hasChanges && (
            <span className="unsaved-indicator">● Unsaved changes</span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="save-button"
          >
            Save Changes
          </button>
        </div>
      </div>

      <div className="options-content">
        {/* General Settings */}
        <div className="settings-section">
          <h2>General Settings</h2>
          
          <div className="settings-grid">
            <div className="setting-item">
              <label className="setting-label">Dark Mode</label>
              <div className="setting-control">
                <input
                  type="checkbox"
                  checked={settings.darkMode}
                  onChange={(e) => handleSettingChange('darkMode', e.target.checked)}
                  className="toggle-switch"
                />
              </div>
            </div>
            
            <div className="setting-item">
              <label className="setting-label">Max History Size</label>
              <div className="setting-control">
                <select
                  value={settings.maxHistorySize}
                  onChange={(e) => handleSettingChange('maxHistorySize', parseInt(e.target.value))}
                  className="select-input"
                >
                  <option value={50}>50 items</option>
                  <option value={100}>100 items</option>
                  <option value={200}>200 items</option>
                  <option value={500}>500 items</option>
                  <option value={1000}>1000 items</option>
                </select>
              </div>
            </div>
            
            <div className="setting-item">
              <label className="setting-label">Data Retention</label>
              <div className="setting-control">
                <select
                  value={settings.dataRetentionDays}
                  onChange={(e) => handleSettingChange('dataRetentionDays', parseInt(e.target.value))}
                  className="select-input"
                >
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                  <option value={365}>1 year</option>
                  <option value={730}>2 years</option>
                  <option value={0}>Forever</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Synchronization */}
        <div className="settings-section">
          <h2>Synchronization</h2>
          
          <div className="settings-grid">
            <div className="setting-item">
              <label className="setting-label">Auto Sync</label>
              <div className="setting-control">
                <input
                  type="checkbox"
                  checked={settings.autoSync}
                  onChange={(e) => handleSettingChange('autoSync', e.target.checked)}
                  className="toggle-switch"
                />
              </div>
            </div>
            
            <div className="setting-item">
              <label className="setting-label">Sync Interval</label>
              <div className="setting-control">
                <select
                  value={settings.syncInterval}
                  onChange={(e) => handleSettingChange('syncInterval', parseInt(e.target.value))}
                  className="select-input"
                >
                  <option value={60000}>1 minute</option>
                  <option value={300000}>5 minutes</option>
                  <option value={600000}>10 minutes</option>
                  <option value={1800000}>30 minutes</option>
                  <option value={3600000}>1 hour</option>
                </select>
              </div>
            </div>
            
            <div className="setting-item full-width">
              <label className="setting-label">Sync URL</label>
              <div className="setting-control">
                <input
                  type="url"
                  value={settings.syncUrl || ''}
                  onChange={(e) => handleSettingChange('syncUrl', e.target.value)}
                  placeholder="https://your-sync-server.com/api"
                  className="text-input"
                />
              </div>
            </div>
            
            <div className="setting-item full-width">
              <label className="setting-label">API Key</label>
              <div className="setting-control">
                <input
                  type="password"
                  value={settings.apiKey || ''}
                  onChange={(e) => handleSettingChange('apiKey', e.target.value)}
                  placeholder="Your API key"
                  className="text-input"
                />
              </div>
            </div>
          </div>
          
          <div className="connection-test">
            <button
              onClick={handleTestConnections}
              disabled={isTesting}
              className="test-button"
            >
              {isTesting ? 'Testing...' : 'Test Connections'}
            </button>
            
            <div className="test-results">
              <span className={`test-result ${testResults.storage ? 'success' : 'error'}`}>
                Storage: {testResults.storage ? '✓' : '✗'}
              </span>
              <span className={`test-result ${testResults.connection ? 'success' : 'error'}`}>
                API: {testResults.connection ? '✓' : '✗'}
              </span>
              <span className={`test-result ${testResults.gmail ? 'success' : 'error'}`}>
                Gmail: {testResults.gmail ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="settings-section">
          <h2>Features</h2>
          
          <div className="settings-grid">
            <div className="setting-item">
              <label className="setting-label">Voice Commands</label>
              <div className="setting-control">
                <input
                  type="checkbox"
                  checked={settings.enableVoiceCommands}
                  onChange={(e) => handleSettingChange('enableVoiceCommands', e.target.checked)}
                  className="toggle-switch"
                />
              </div>
            </div>
            
            <div className="setting-item">
              <label className="setting-label">Notifications</label>
              <div className="setting-control">
                <input
                  type="checkbox"
                  checked={settings.enableNotifications}
                  onChange={(e) => handleSettingChange('enableNotifications', e.target.checked)}
                  className="toggle-switch"
                />
              </div>
            </div>
            
            <div className="setting-item">
              <label className="setting-label">Gmail Integration</label>
              <div className="setting-control">
                <input
                  type="checkbox"
                  checked={settings.gmailIntegration}
                  onChange={(e) => handleSettingChange('gmailIntegration', e.target.checked)}
                  className="toggle-switch"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="settings-section">
          <h2>Data Management</h2>
          
          <div className="data-management">
            <div className="data-section">
              <h3>Export Data</h3>
              <p>Download all your settings and memories as a JSON file.</p>
              <div className="data-actions">
                <button onClick={handleExportData} className="export-button">
                  Generate Export
                </button>
                {exportData && (
                  <button
                    onClick={() => {
                      const blob = new Blob([exportData], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `spur-export-${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="download-button"
                  >
                    Download Export
                  </button>
                )}
              </div>
              {exportData && (
                <textarea
                  value={exportData}
                  readOnly
                  rows={10}
                  className="export-textarea"
                />
              )}
            </div>
            
            <div className="data-section">
              <h3>Import Data</h3>
              <p>Import settings and memories from a JSON file.</p>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste your exported JSON data here..."
                rows={8}
                className="import-textarea"
              />
              <button
                onClick={handleImportData}
                disabled={!importData.trim()}
                className="import-button"
              >
                Import Data
              </button>
            </div>
          </div>
          
          <div className="danger-zone">
            <h3>Danger Zone</h3>
            <p>These actions cannot be undone.</p>
            <button
              onClick={handleClearAllData}
              className="clear-button"
            >
              Clear All Data
            </button>
          </div>
        </div>

        {/* About */}
        <div className="settings-section">
          <h2>About</h2>
          <div className="about-info">
            <div className="info-item">
              <label>Version</label>
              <span>{chrome.runtime.getManifest().version}</span>
            </div>
            <div className="info-item">
              <label>Storage Used</label>
              <span id="storage-used">Calculating...</span>
            </div>
            <div className="info-item">
              <label>Total Memories</label>
              <span id="total-memories">0</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .options-container {
          min-width: 600px;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #333;
        }

        .options-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e0e0e0;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .header-icon {
          width: 48px;
          height: 48px;
        }

        .header-content h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .header-content p {
          margin: 4px 0 0 0;
          color: #666;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .unsaved-indicator {
          color: #ff9800;
          font-weight: 500;
        }

        .save-button {
          background: #4285f4;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .save-button:hover:not(:disabled) {
          background: #3367d6;
        }

        .save-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .options-content {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .settings-section {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
        }

        .settings-section h2 {
          margin: 0 0 20px 0;
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }

        .setting-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .setting-item.full-width {
          grid-column: 1 / -1;
        }

        .setting-label {
          font-size: 14px;
          font-weight: 500;
          color: #333;
        }

        .setting-control {
          display: flex;
          align-items: center;
        }

        .toggle-switch {
          width: 44px;
          height: 24px;
          appearance: none;
          background: #ccc;
          border-radius: 12px;
          position: relative;
          cursor: pointer;
          transition: background 0.3s ease;
        }

        .toggle-switch:checked {
          background: #4285f4;
        }

        .toggle-switch::before {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          top: 2px;
          left: 2px;
          transition: transform 0.3s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .toggle-switch:checked::before {
          transform: translateX(20px);
        }

        .select-input, .text-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          background: white;
        }

        .select-input:focus, .text-input:focus {
          outline: none;
          border-color: #4285f4;
          box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.1);
        }

        .connection-test {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
        }

        .test-button {
          background: #f5f5f5;
          border: 1px solid #ddd;
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          margin-bottom: 12px;
        }

        .test-button:hover:not(:disabled) {
          background: #eeeeee;
        }

        .test-results {
          display: flex;
          gap: 16px;
          font-size: 14px;
        }

        .test-result {
          padding: 4px 8px;
          border-radius: 4px;
        }

        .test-result.success {
          background: #e8f5e8;
          color: #2e7d32;
        }

        .test-result.error {
          background: #ffebee;
          color: #c62828;
        }

        .data-management {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .data-section {
          background: #f9f9f9;
          padding: 16px;
          border-radius: 6px;
        }

        .data-section h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .data-section p {
          margin: 0 0 12px 0;
          font-size: 13px;
          color: #666;
        }

        .data-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .export-button, .import-button, .download-button {
          padding: 8px 12px;
          border: none;
          border-radius: 4px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .export-button, .download-button {
          background: #4caf50;
          color: white;
        }

        .export-button:hover, .download-button:hover {
          background: #45a049;
        }

        .import-button {
          background: #2196f3;
          color: white;
        }

        .import-button:hover:not(:disabled) {
          background: #1976d2;
        }

        .import-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .export-textarea, .import-textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          resize: vertical;
        }

        .danger-zone {
          background: #ffebee;
          padding: 16px;
          border-radius: 6px;
          border: 1px solid #ffcdd2;
        }

        .danger-zone h3 {
          margin: 0 0 8px 0;
          color: #c62828;
        }

        .danger-zone p {
          margin: 0 0 12px 0;
          font-size: 13px;
          color: #666;
        }

        .clear-button {
          background: #f44336;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
        }

        .clear-button:hover {
          background: #da190b;
        }

        .about-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .info-item label {
          font-weight: 500;
          color: #666;
        }

        .info-item span {
          color: #333;
        }
      `}</style>
    </div>
  );
};

export default Options;
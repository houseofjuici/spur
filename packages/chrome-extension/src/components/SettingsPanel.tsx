import React, { useState } from 'react';

interface Settings {
  enableNotifications: boolean;
  autoSync: boolean;
  darkMode: boolean;
  maxHistorySize: number;
  syncInterval: number;
  enableVoiceCommands: boolean;
  gmailIntegration: boolean;
  dataRetentionDays: number;
}

interface SettingsPanelProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange
}) => {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSettingChange = (key: keyof Settings, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    setHasChanges(JSON.stringify(newSettings) !== JSON.stringify(settings));
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    setHasChanges(false);
  };

  const handleReset = () => {
    const defaultSettings: Settings = {
      enableNotifications: true,
      autoSync: true,
      darkMode: false,
      maxHistorySize: 100,
      syncInterval: 300000, // 5 minutes
      enableVoiceCommands: true,
      gmailIntegration: false,
      dataRetentionDays: 365
    };
    setLocalSettings(defaultSettings);
    setHasChanges(true);
  };

  const formatSyncInterval = (milliseconds: number): string => {
    const minutes = milliseconds / (1000 * 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = minutes / 60;
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h3>⚙️ Settings</h3>
        {hasChanges && (
          <div className="unsaved-changes">
            <span className="unsaved-indicator">●</span>
            <span>Unsaved changes</span>
          </div>
        )}
      </div>

      <div className="settings-sections">
        {/* General Settings */}
        <div className="settings-section">
          <h4>General</h4>
          
          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="darkMode" className="setting-label">Dark Mode</label>
              <p className="setting-description">Use dark theme for the popup</p>
            </div>
            <div className="setting-control">
              <input
                type="checkbox"
                id="darkMode"
                checked={localSettings.darkMode}
                onChange={(e) => handleSettingChange('darkMode', e.target.checked)}
                className="toggle-switch"
              />
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="maxHistorySize" className="setting-label">Max History Size</label>
              <p className="setting-description">Maximum number of memories to keep</p>
            </div>
            <div className="setting-control">
              <select
                id="maxHistorySize"
                value={localSettings.maxHistorySize}
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
            <div className="setting-info">
              <label htmlFor="dataRetentionDays" className="setting-label">Data Retention</label>
              <p className="setting-description">Keep memories for this many days</p>
            </div>
            <div className="setting-control">
              <select
                id="dataRetentionDays"
                value={localSettings.dataRetentionDays}
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

        {/* Sync Settings */}
        <div className="settings-section">
          <h4>Synchronization</h4>
          
          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="autoSync" className="setting-label">Auto Sync</label>
              <p className="setting-description">Automatically sync with cloud storage</p>
            </div>
            <div className="setting-control">
              <input
                type="checkbox"
                id="autoSync"
                checked={localSettings.autoSync}
                onChange={(e) => handleSettingChange('autoSync', e.target.checked)}
                className="toggle-switch"
              />
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="syncInterval" className="setting-label">Sync Interval</label>
              <p className="setting-description">How often to sync automatically</p>
            </div>
            <div className="setting-control">
              <select
                id="syncInterval"
                value={localSettings.syncInterval}
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
        </div>

        {/* Voice Settings */}
        <div className="settings-section">
          <h4>Voice & Audio</h4>
          
          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="enableVoiceCommands" className="setting-label">Voice Commands</label>
              <p className="setting-description">Enable voice command recognition</p>
            </div>
            <div className="setting-control">
              <input
                type="checkbox"
                id="enableVoiceCommands"
                checked={localSettings.enableVoiceCommands}
                onChange={(e) => handleSettingChange('enableVoiceCommands', e.target.checked)}
                className="toggle-switch"
              />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="settings-section">
          <h4>Notifications</h4>
          
          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="enableNotifications" className="setting-label">Notifications</label>
              <p className="setting-description">Show desktop notifications</p>
            </div>
            <div className="setting-control">
              <input
                type="checkbox"
                id="enableNotifications"
                checked={localSettings.enableNotifications}
                onChange={(e) => handleSettingChange('enableNotifications', e.target.checked)}
                className="toggle-switch"
              />
            </div>
          </div>
        </div>

        {/* Integrations */}
        <div className="settings-section">
          <h4>Integrations</h4>
          
          <div className="setting-item">
            <div className="setting-info">
              <label htmlFor="gmailIntegration" className="setting-label">Gmail Integration</label>
              <p className="setting-description">Enable Gmail email processing</p>
            </div>
            <div className="setting-control">
              <input
                type="checkbox"
                id="gmailIntegration"
                checked={localSettings.gmailIntegration}
                onChange={(e) => handleSettingChange('gmailIntegration', e.target.checked)}
                className="toggle-switch"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="save-button"
        >
          Save Changes
        </button>
        <button
          onClick={handleReset}
          className="reset-button"
        >
          Reset to Defaults
        </button>
      </div>

      <style jsx>{`
        .settings-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 8px;
          border-bottom: 1px solid #e0e0e0;
        }

        .settings-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .unsaved-changes {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #ff9800;
        }

        .unsaved-indicator {
          color: #ff9800;
          animation: blink 1s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .settings-sections {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .settings-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .settings-section h4 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 8px 0;
        }

        .setting-info {
          flex: 1;
          margin-right: 16px;
        }

        .setting-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #333;
          margin-bottom: 2px;
          cursor: pointer;
        }

        .setting-description {
          font-size: 12px;
          color: #666;
          margin: 0;
          line-height: 1.3;
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

        .select-input {
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 13px;
          background: white;
          cursor: pointer;
        }

        .select-input:focus {
          outline: none;
          border-color: #4285f4;
          box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.1);
        }

        .settings-actions {
          display: flex;
          gap: 8px;
          padding-top: 16px;
          border-top: 1px solid #e0e0e0;
        }

        .save-button, .reset-button {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .save-button {
          background: #4285f4;
          color: white;
        }

        .save-button:hover:not(:disabled) {
          background: #3367d6;
        }

        .save-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .reset-button {
          background: #f5f5f5;
          color: #666;
          border: 1px solid #ddd;
        }

        .reset-button:hover {
          background: #eeeeee;
        }
      `}</style>
    </div>
  );
};
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('theme');
      if (saved) {
        setIsDarkMode(saved === 'dark');
      }
    } catch (e) {
      console.error('Failed to load theme', e);
    }
  };

  const toggleTheme = async () => {
    try {
      const newValue = !isDarkMode;
      setIsDarkMode(newValue);
      await AsyncStorage.setItem('theme', newValue ? 'dark' : 'light');
    } catch (e) {
      console.error('Failed to save theme', e);
    }
  };

  const value = {
    isDarkMode,
    toggleTheme,
    colors: {
      // Primary Colors
      primary: isDarkMode ? '#4DA0E1' : '#1874C0',
      primaryDark: isDarkMode ? '#1874C0' : '#0F4F87',
      primaryLight: isDarkMode ? '#7DC3F2' : '#4DA0E1',
      primarySoft: isDarkMode ? '#7DC3F2' : '#4DA0E1',
      
      // Background Colors
      background: isDarkMode ? '#0B1120' : '#F8FAFC',
      bg: isDarkMode ? '#0B1120' : '#F8FAFC',
      surface: isDarkMode ? '#1E293B' : '#FFFFFF',
      surfaceVariant: isDarkMode ? '#27354A' : '#F1F5F9',
      cardBackground: isDarkMode ? '#1E293B' : '#FFFFFF',
      
      // Text Colors
      textPrimary: isDarkMode ? '#F8FAFC' : '#0F172A',
      textSecondary: isDarkMode ? '#CBD5E1' : '#334155',
      textMuted: isDarkMode ? '#94A3B8' : '#64748B',
      
      // Status Colors
      success: isDarkMode ? '#4ADE80' : '#22C55E',
      warning: isDarkMode ? '#FBBF24' : '#F59E0B',
      error: isDarkMode ? '#F87171' : '#EF4444',
      
      // Border & Divider
      border: isDarkMode ? '#475569' : '#CBD5E1',
      divider: isDarkMode ? '#334155' : '#E2E8F0',
      
      // Legacy support
      statusBar: isDarkMode ? 'light-content' : 'dark-content',
      shadow: isDarkMode ? '#000000' : '#0F172A',
    },
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

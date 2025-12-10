import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from './ThemeContext';
import SecuritySettings from './securitysettings';
import { ActivityLogger } from './activityLogger';

const NOTIFICATIONS_KEY = 'vitalsense:notifications_enabled';

export default function Settings({ onBack, onNavigate, user }) {
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);

  // Load notification preference from storage
  useEffect(() => {
    const loadNotificationPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
        if (stored !== null) {
          setNotifications(stored === 'true');
        }
      } catch (err) {
        console.warn('Failed to load notification preference', err);
      }
    };
    loadNotificationPreference();
  }, []);

  // Log viewing settings activity
  useEffect(() => {
    if (user && user.studentId) {
      ActivityLogger.viewSettings(user.studentId);
    }
  }, [user]);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive', 
          onPress: async () => {
            // Log logout activity
            if (user && user.studentId) {
              await ActivityLogger.logout(user.studentId);
            }
            // Navigate to Login screen
            if (typeof onNavigate === 'function') {
              onNavigate('Login');
            } else if (typeof onBack === 'function') {
              onBack();
            }
          }
        },
      ]
    );
  };

  const settingsOptions = [
    {
      id: 1,
      icon: 'moon',
      iconColor: '#6B46C1',
      bgColor: '#EDE7F6',
      title: 'Dark Mode',
      subtitle: isDarkMode ? 'Enabled' : 'Disabled',
      type: 'toggle',
      value: isDarkMode,
      onToggle: () => {
        toggleTheme();
        if (user && user.studentId) {
          ActivityLogger.toggleDarkMode(user.studentId, !isDarkMode);
        }
      },
    },
    {
      id: 2,
      icon: 'notifications',
      iconColor: '#2196F3',
      bgColor: '#E3F2FD',
      title: 'Notifications',
      subtitle: notifications ? 'Enabled' : 'Disabled',
      type: 'toggle',
      value: notifications,
      onToggle: async (val) => {
        setNotifications(val);
        try {
          await AsyncStorage.setItem(NOTIFICATIONS_KEY, val.toString());
        } catch (err) {
          console.warn('Failed to save notification preference', err);
        }
        if (user && user.studentId) {
          ActivityLogger.toggleNotifications(user.studentId, val);
        }
      },
    },
    {
      id: 4,
      icon: 'shield-checkmark',
      iconColor: '#FF9800',
      bgColor: '#FFF3E0',
      title: 'Privacy & Security',
      subtitle: 'Manage your privacy settings',
      type: 'navigation',
      onPress: () => {
        if (user && user.studentId) {
          ActivityLogger.viewSecuritySettings(user.studentId);
        }
        setShowSecuritySettings(true);
      },
    },
    {
      id: 5,
      icon: 'help-circle',
      iconColor: '#00BCD4',
      bgColor: '#E0F7FA',
      title: 'Help & Support',
      subtitle: 'Get assistance',
      type: 'navigation',
      onPress: () => Alert.alert(
        'Help & Support',
        'Need assistance? Contact us:\n\nEmail: vitalsense@outlook.com\n\nPhone: 09685684836\n\nWe\'re here to help you!',
        [{ text: 'OK' }]
      ),
    },
    {
      id: 6,
      icon: 'information-circle',
      iconColor: '#9C27B0',
      bgColor: '#F3E5F5',
      title: 'About',
      subtitle: 'App version 1.0.0',
      type: 'navigation',
      onPress: () => Alert.alert(
        'About VitalSense',
        'VitalSense - Your Health Companion\n\nVersion: 1.0.0\n\nVitalSense is a comprehensive health monitoring application designed to help students track their vital signs and maintain their wellness. Monitor your blood pressure, temperature, heart rate, and mood all in one place.\n\nDeveloped with care for student health and well-being.\n\n© 2024 VitalSense. All rights reserved.',
        [{ text: 'OK' }]
      ),
    },
  ];

  if (showSecuritySettings) {
    return (
      <SecuritySettings 
        onBack={() => setShowSecuritySettings(false)} 
        user={user} 
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Settings Options */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.cardBackground }]}>
          {settingsOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.settingItem, { borderBottomColor: colors.border }]}
              activeOpacity={option.type === 'toggle' ? 1 : 0.7}
              onPress={option.type === 'navigation' ? option.onPress : null}
            >
              <View style={[styles.iconContainer, { backgroundColor: option.bgColor }]}>
                <Ionicons name={option.icon} size={22} color={option.iconColor} />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{option.title}</Text>
                <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{option.subtitle}</Text>
              </View>
              {option.type === 'toggle' ? (
                <Switch
                  value={option.value}
                  onValueChange={option.onToggle}
                  trackColor={{ false: '#E5E7EB', true: '#C4B5FD' }}
                  thumbColor={option.value ? '#6B46C1' : '#F3F4F6'}
                  ios_backgroundColor="#E5E7EB"
                />
              ) : (
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.cardBackground }]}
          activeOpacity={0.8}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={[styles.versionText, { color: colors.textSecondary }]}>VitalSense v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: '#F9FAFB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  placeholder: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
    marginLeft: 8,
  },
  versionText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    fontWeight: '500',
  },
});

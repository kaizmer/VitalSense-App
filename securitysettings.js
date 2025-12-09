import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';

// Supabase REST config
const SUPABASE_URL = 'https://dftmxaoxygilbhbonrnu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YyxtmFa4_omJeaejR6S3gA_D6f1Ycs0';

export default function SecuritySettings({ onBack, user }) {
  const { colors } = useTheme();
  
  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // PIN code change states
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  
  // Success indicators
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [pinUpdated, setPinUpdated] = useState(false);
  
  // Loading and stored data
  const [loading, setLoading] = useState(true);
  const [storedPassword, setStoredPassword] = useState('');
  const [storedPin, setStoredPin] = useState('');
  
  // Custom alert modal
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  
  const studentId = user?.studentId ?? user?.student_id ?? '';
  
  // Custom alert function
  const showAlert = (title, message) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  // Fetch current password and PIN from database
  useEffect(() => {
    const fetchSecurityData = async () => {
      if (!studentId) {
        setLoading(false);
        return;
      }
      try {
        const url = `${SUPABASE_URL}/rest/v1/students?select=password,pin_code&student_id=eq.${studentId}&limit=1`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok) {
          console.warn('Failed fetching security data', await res.text());
          setLoading(false);
          return;
        }
        const rows = await res.json();
        const student = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (student) {
          setStoredPassword(student.password || '');
          setStoredPin(student.pin_code || '');
        }
      } catch (err) {
        console.warn('Error fetching security data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSecurityData();
  }, [studentId]);

  const handleChangePassword = async () => {
    console.log('handleChangePassword called');
    console.log('Current:', currentPassword, 'New:', newPassword, 'Confirm:', confirmPassword);
    console.log('Stored password:', storedPassword);
    
    // Check if all fields are filled
    if (!currentPassword || !newPassword || !confirmPassword) {
      console.log('SHOWING ALERT: Missing fields');
      showAlert('Missing Information', 'Please fill in all password fields to continue.');
      return;
    }
    
    // Verify current password matches stored password
    if (currentPassword !== storedPassword) {
      console.log('SHOWING ALERT: Wrong current password');
      showAlert('Incorrect Password', 'The current password you entered is incorrect. Please try again.');
      return;
    }
    
    // Check if new passwords match
    if (newPassword !== confirmPassword) {
      console.log('SHOWING ALERT: New passwords dont match');
      showAlert('Password Mismatch', 'The new password and confirmation password do not match. Please check and try again.');
      return;
    }
    
    // Check password length
    if (newPassword.length < 6) {
      console.log('SHOWING ALERT: Password too short');
      showAlert('Password Too Short', 'Your new password must be at least 6 characters long for security.');
      return;
    }
    
    console.log('All validations passed, updating password...');
    
    try {
      // Update password in Supabase
      const url = `${SUPABASE_URL}/rest/v1/students?student_id=eq.${studentId}`;
      
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ password: newPassword }),
      });
      
      if (!res.ok) {
        const text = await res.text();
        showAlert('Update Failed', `Unable to update password. Server responded with: ${res.status}`);
        return;
      }
      
      // Update successful
      setStoredPassword(newPassword);
      setPasswordUpdated(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setPasswordUpdated(false);
      }, 3000);
    } catch (err) {
      showAlert('Error', `An error occurred while updating your password: ${err.message}`);
    }
  };

  const handleChangePin = async () => {
    console.log('handleChangePin called');
    console.log('Current PIN:', currentPin, 'New PIN:', newPin, 'Confirm PIN:', confirmPin);
    console.log('Stored PIN:', storedPin);
    
    // Check if all fields are filled
    if (!currentPin || !newPin || !confirmPin) {
      console.log('SHOWING ALERT: Missing PIN fields');
      showAlert('Missing Information', 'Please fill in all PIN fields to continue.');
      return;
    }
    
    // Verify current PIN matches stored PIN
    if (currentPin !== storedPin) {
      console.log('SHOWING ALERT: Wrong current PIN');
      showAlert('Incorrect PIN', 'The current PIN you entered is incorrect. Please try again.');
      return;
    }
    
    // Check if new PINs match
    if (newPin !== confirmPin) {
      console.log('SHOWING ALERT: New PINs dont match');
      showAlert('PIN Mismatch', 'The new PIN and confirmation PIN do not match. Please check and try again.');
      return;
    }
    
    // Check PIN format (6 digits)
    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      console.log('SHOWING ALERT: Invalid PIN format');
      showAlert('Invalid PIN Format', 'Your PIN must be exactly 6 digits (numbers only).');
      return;
    }
    
    console.log('All PIN validations passed, updating PIN...');
    
    try {
      // Update PIN in Supabase
      const url = `${SUPABASE_URL}/rest/v1/students?student_id=eq.${studentId}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ pin_code: newPin }),
      });
      
      if (!res.ok) {
        const text = await res.text();
        showAlert('Update Failed', `Unable to update PIN. Server responded with: ${res.status}`);
        return;
      }
      
      // Update successful
      setStoredPin(newPin);
      setPinUpdated(true);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setPinUpdated(false);
      }, 3000);
    } catch (err) {
      showAlert('Error', `An error occurred while updating your PIN: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Privacy & Security</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B46C1" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading security settings...</Text>
        </View>
      </SafeAreaView>
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Privacy & Security</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Change Password Section */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="lock-closed" size={20} color="#F59E0B" />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Change Password</Text>
          </View>

          {passwordUpdated && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.successText}>Password updated successfully!</Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Current Password</Text>
            <View style={[styles.passwordInput, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Enter current password"
                placeholderTextColor={colors.textSecondary}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                <Ionicons
                  name={showCurrentPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>New Password</Text>
            <View style={[styles.passwordInput, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Enter new password"
                placeholderTextColor={colors.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                <Ionicons
                  name={showNewPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm New Password</Text>
            <View style={[styles.passwordInput, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                <Ionicons
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            activeOpacity={0.8}
            onPress={handleChangePassword}
          >
            <Text style={styles.saveButtonText}>Update Password</Text>
          </TouchableOpacity>
        </View>

        {/* Change PIN Code Section */}
        <View style={[styles.section, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="keypad" size={20} color="#2196F3" />
            </View>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Change QR Code PIN</Text>
          </View>

          {pinUpdated && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              <Text style={styles.successText}>PIN updated successfully!</Text>
            </View>
          )}

          <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
            This PIN is used to secure your QR code access
          </Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Current PIN</Text>
            <View style={[styles.passwordInput, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Enter current PIN"
                placeholderTextColor={colors.textSecondary}
                value={currentPin}
                onChangeText={setCurrentPin}
                secureTextEntry={!showCurrentPin}
                keyboardType="numeric"
                maxLength={6}
              />
              <TouchableOpacity onPress={() => setShowCurrentPin(!showCurrentPin)}>
                <Ionicons
                  name={showCurrentPin ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>New PIN</Text>
            <View style={[styles.passwordInput, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Enter new 6-digit PIN"
                placeholderTextColor={colors.textSecondary}
                value={newPin}
                onChangeText={setNewPin}
                secureTextEntry={!showNewPin}
                keyboardType="numeric"
                maxLength={6}
              />
              <TouchableOpacity onPress={() => setShowNewPin(!showNewPin)}>
                <Ionicons
                  name={showNewPin ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm New PIN</Text>
            <View style={[styles.passwordInput, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.textPrimary }]}
                placeholder="Confirm new PIN"
                placeholderTextColor={colors.textSecondary}
                value={confirmPin}
                onChangeText={setConfirmPin}
                secureTextEntry={!showConfirmPin}
                keyboardType="numeric"
                maxLength={6}
              />
              <TouchableOpacity onPress={() => setShowConfirmPin(!showConfirmPin)}>
                <Ionicons
                  name={showConfirmPin ? 'eye-off' : 'eye'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            activeOpacity={0.8}
            onPress={handleChangePin}
          >
            <Text style={styles.saveButtonText}>Update PIN</Text>
          </TouchableOpacity>
        </View>

        {/* Security Tips */}
        <View style={[styles.tipsContainer, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.tipHeader}>
            <Ionicons name="information-circle" size={20} color="#6366F1" />
            <Text style={[styles.tipTitle, { color: colors.textPrimary }]}>Security Tips</Text>
          </View>
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            • Use a strong password with at least 6 characters{'\n'}
            • Don't share your PIN code with anyone{'\n'}
            • Change your credentials regularly{'\n'}
            • Use unique passwords for different accounts
          </Text>
        </View>
      </ScrollView>
      
      {/* Custom Alert Modal */}
      <Modal
        transparent={true}
        visible={alertVisible}
        animationType="fade"
        onRequestClose={() => setAlertVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.alertBox, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.alertIconContainer}>
              <Ionicons name="alert-circle" size={48} color="#EF4444" />
            </View>
            <Text style={[styles.alertTitle, { color: colors.textPrimary }]}>{alertTitle}</Text>
            <Text style={[styles.alertMessage, { color: colors.textSecondary }]}>{alertMessage}</Text>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => setAlertVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingTop: 48,
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
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#212121',
  },
  sectionDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  passwordInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#212121',
    paddingVertical: 12,
  },
  saveButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#6B46C1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tipsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginLeft: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  alertBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  alertIconContainer: {
    marginBottom: 16,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 12,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  alertButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    minWidth: 120,
    shadowColor: '#6B46C1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

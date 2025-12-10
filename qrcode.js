import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from './ThemeContext';
import { ActivityLogger } from './activityLogger';

// Supabase REST config
const SUPABASE_URL = 'https://dftmxaoxygilbhbonrnu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YyxtmFa4_omJeaejR6S3gA_D6f1Ycs0';

export default function QRScreen({ onNavigate, onBack, user }) {
  const { colors } = useTheme();
  
  const [pinCode, setPinCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [storedPin, setStoredPin] = useState(null);
  const [loadingPin, setLoadingPin] = useState(true);

  // New states for PIN creation
  const [isCreatingPin, setIsCreatingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSavingPin, setIsSavingPin] = useState(false);

  const studentId = user?.studentId ?? user?.student_id ?? '';
  const password = user?.password ?? user?.pass ?? '';
  const payload = JSON.stringify({ student_id: studentId, password });

  // Log QR code view activity
  useEffect(() => {
    if (user && user.studentId) {
      ActivityLogger.viewQRCode(user.studentId);
    }
  }, [user]);

  // Fetch student's PIN code from database
  useEffect(() => {
    const fetchPin = async () => {
      if (!studentId) {
        setLoadingPin(false);
        return;
      }
      try {
        const url = `${SUPABASE_URL}/rest/v1/students?select=pin_code&student_id=eq.${studentId}&limit=1`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok) {
          console.warn('Failed fetching PIN', await res.text());
          setLoadingPin(false);
          return;
        }
        const rows = await res.json();
        const student = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (student && student.pin_code) {
          setStoredPin(student.pin_code);
        } else {
          // No PIN set, show creation form
          setIsCreatingPin(true);
        }
      } catch (err) {
        console.warn('Error fetching PIN', err);
      } finally {
        setLoadingPin(false);
      }
    };
    fetchPin();
  }, [studentId]);

  // Handle PIN creation
  const handleCreatePin = async () => {
    if (!newPin.trim() || !confirmPin.trim()) {
      Alert.alert('Error', 'Please fill both PIN fields.');
      return;
    }
    if (newPin.length !== 6) {
      Alert.alert('Error', 'PIN code must be exactly 6 digits.');
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      Alert.alert('Error', 'PIN code must contain only numbers.');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('Error', 'PIN codes do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    setIsSavingPin(true);
    try {
      const url = `${SUPABASE_URL}/rest/v1/students?student_id=eq.${studentId}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ pin_code: newPin }),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.warn('Failed to save PIN', txt);
        Alert.alert('Error', 'Failed to save PIN. Please try again.');
        return;
      }

      setStoredPin(newPin);
      setIsCreatingPin(false);
      setNewPin('');
      setConfirmPin('');
      
      // Log PIN creation activity
      if (studentId) {
        await ActivityLogger.createPIN(studentId);
      }
      
      Alert.alert('Success', 'Your PIN has been created successfully!');
    } catch (err) {
      console.warn('Error saving PIN', err);
      Alert.alert('Error', 'Unexpected error saving PIN.');
    } finally {
      setIsSavingPin(false);
    }
  };

  // Verify PIN code
  const handleVerifyPin = () => {
    if (!pinCode.trim()) {
      Alert.alert('Error', 'Please enter your PIN code.');
      return;
    }
    if (pinCode.length !== 6) {
      Alert.alert('Error', 'PIN code must be 6 digits.');
      return;
    }
    if (!storedPin) {
      Alert.alert('Error', 'No PIN found. Please set your PIN first.');
      return;
    }

    setIsVerifying(true);
    
    // Simulate verification delay
    setTimeout(() => {
      if (pinCode === storedPin) {
        setIsVerified(true);
        
        // Log PIN verification activity
        if (studentId) {
          ActivityLogger.verifyPIN(studentId);
        }
        
        Alert.alert('Success', 'PIN verified! QR code unlocked.');
      } else {
        Alert.alert('Error', 'Incorrect PIN code. Please try again.');
        setPinCode('');
      }
      setIsVerifying(false);
    }, 500);
  };

  // Reset verification when navigating away
  useEffect(() => {
    return () => {
      setIsVerified(false);
      setPinCode('');
    };
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          onPress={() => (typeof onBack === 'function' ? onBack() : (typeof onNavigate === 'function' && onNavigate('Home')))} 
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>My QR Code</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {loadingPin ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
          </View>
        ) : !studentId ? (
          <Text style={styles.warn}>No student ID available.</Text>
        ) : isCreatingPin ? (
          // PIN Creation Form
          <View style={styles.createPinContainer}>
            <Ionicons name="shield-checkmark" size={64} color={colors.primary} style={{ marginBottom: 20 }} />
            <Text style={[styles.createPinTitle, { color: colors.textPrimary }]}>Create Your PIN</Text>
            <Text style={[styles.createPinSubtitle, { color: colors.textSecondary }]}>
              Set a 6-digit PIN to protect your QR code
            </Text>

            <View style={styles.pinInputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Enter PIN</Text>
              <TextInput
                style={[styles.pinInput, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="••••••"
                placeholderTextColor={colors.textMuted}
                value={newPin}
                onChangeText={setNewPin}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                editable={!isSavingPin}
              />
            </View>

            <View style={styles.pinInputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Confirm PIN</Text>
              <TextInput
                style={[styles.pinInput, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="••••••"
                placeholderTextColor={colors.textMuted}
                value={confirmPin}
                onChangeText={setConfirmPin}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                editable={!isSavingPin}
              />
            </View>

            <TouchableOpacity
              style={[styles.createPinButton, { backgroundColor: colors.primary }, isSavingPin && styles.verifyButtonDisabled]}
              onPress={handleCreatePin}
              disabled={isSavingPin}
            >
              {isSavingPin ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createPinButtonText}>Create PIN</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : !isVerified ? (
          <>
            {/* Blurred QR Code */}
            <View style={[styles.blurredQRContainer, { backgroundColor: colors.border }]}>
              <View style={[styles.qrPlaceholder, { backgroundColor: colors.cardBackground }]} />
              <View style={[styles.blurOverlay, { backgroundColor: `${colors.primary}F8` }]}>
                <Ionicons name="lock-closed" size={48} color="#fff" />
                <Text style={styles.blurText}>Enter PIN to unlock</Text>
              </View>
            </View>

            {/* PIN Input */}
            <View style={styles.pinContainer}>
              <Text style={[styles.pinLabel, { color: colors.textPrimary }]}>Enter 6-Digit PIN</Text>
              <TextInput
                style={[styles.pinInput, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="••••••"
                placeholderTextColor={colors.textMuted}
                value={pinCode}
                onChangeText={setPinCode}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
                editable={!isVerifying}
              />
              <TouchableOpacity
                style={[styles.verifyButton, { backgroundColor: colors.primary }, isVerifying && styles.verifyButtonDisabled]}
                onPress={handleVerifyPin}
                disabled={isVerifying}
              >
                {isVerifying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.verifyButtonText}>Verify PIN</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Unlocked QR Code */}
            <View style={styles.unlockedContainer}>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.successText}>Verified</Text>
              </View>
              <View style={[styles.qrBox, { backgroundColor: colors.cardBackground }]}>
                <QRCode value={payload} size={260} />
              </View>
              <Text style={[styles.meta, { color: colors.textPrimary }]}>Student ID: {studentId}</Text>
            </View>

            <TouchableOpacity
              style={[styles.infoButton, { backgroundColor: colors.primary }]}
              onPress={() => Alert.alert('QR Code Information', 'This QR code will be used to login or access the kiosk with your account.\n\nDo not share this with anyone.')}
            >
              <Text style={styles.infoText}>About this QR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.lockButton, { backgroundColor: colors.border, borderColor: colors.border }]}
              onPress={() => {
                setIsVerified(false);
                setPinCode('');
              }}
            >
              <Ionicons name="lock-closed" size={18} color={colors.primary} />
              <Text style={[styles.lockButtonText, { color: colors.primary }]}>Lock QR Code</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1, 
  },
  back: { padding: 6 },
  title: { fontSize: 18, fontWeight: '700' },
  container: { flex: 1, alignItems: 'center', paddingTop: 24, paddingHorizontal: 20 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  noPinContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noPinText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  blurredQRContainer: {
    position: 'relative',
    marginBottom: 32,
  },
  qrPlaceholder: {
    width: 284,
    height: 284,
    borderRadius: 12,
  },
  qrBox: { 
    padding: 12, 
    borderRadius: 12, 
    shadowColor: '#000', 
    shadowOpacity: 0.06, 
    elevation: 3 
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  pinContainer: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  pinLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  pinInput: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 20,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 16,
  },
  verifyButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  unlockedContainer: {
    alignItems: 'center',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  successText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  meta: { 
    marginTop: 16, 
    fontSize: 14, 
    fontWeight: '600' 
  },
  warn: { 
    color: '#B91C1C', 
    fontWeight: '700', 
    marginBottom: 12,
    fontSize: 16,
  },
  infoButton: { 
    marginTop: 24, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 12, 
  },
  infoText: { 
    color: '#fff', 
    fontWeight: '700' 
  },
  lockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  lockButtonText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  createPinContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 400,
  },
  createPinTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  createPinSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  pinInputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  createPinButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createPinButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

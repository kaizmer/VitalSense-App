import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';

// add Supabase REST endpoint config
const SUPABASE_URL = 'https://dftmxaoxygilbhbonrnu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YyxtmFa4_omJeaejR6S3gA_D6f1Ycs0';

const { width } = Dimensions.get('window');

export default function Login({ onLogin, onNavigate }) {
  const { colors } = useTheme();

  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [studentIdFocused, setStudentIdFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // replaced handleLogin to use Supabase REST and call onLogin(payload)
  const handleLogin = async () => {
    if (!studentId.trim() || !password) {
      Alert.alert('Validation', 'Please enter student ID and password.');
      return;
    }
    const sid = Number(studentId.trim());
    if (Number.isNaN(sid)) {
      Alert.alert('Validation', 'Student ID must be a number.');
      return;
    }

    try {
      const url = `${SUPABASE_URL}/rest/v1/students?select=student_id,first_name,last_name,password,email&student_id=eq.${sid}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        const text = await res.text();
        Alert.alert('Login failed', `Server error: ${res.status} ${text}`);
        return;
      }
      const rows = await res.json();
      const data = Array.isArray(rows) && rows.length ? rows[0] : null;
      if (!data) {
        Alert.alert('Login failed', 'Student not found.');
        return;
      }

      // plaintext comparison — if you use hashed passwords, verify server-side
      if (data.password !== password) {
        Alert.alert('Login failed', 'Incorrect student ID or password.');
        return;
      }

      const payload = {
        studentId: data.student_id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        // include the entered password so QR screen can generate full payload
        password: password,
      };

      if (typeof onLogin === 'function') {
        onLogin(payload); // App.js will handle navigation to Home
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Unexpected error');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingVertical: 40,
    },
    formContainer: {
      width: '100%',
      maxWidth: 400,
      alignSelf: 'center',
    },
    titleContainer: {
      alignItems: 'center',
      marginBottom: 48,
    },
    title: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.primary,
      letterSpacing: 0.3,
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8,
      marginLeft: 2,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 14,
      height: 52,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    inputWrapperFocused: {
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      fontSize: 15,
      color: colors.textPrimary,
      height: '100%',
    },
    passwordInput: {
      paddingRight: 8,
    },
    eyeIcon: {
      padding: 4,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    buttonText: {
      color: colors.surface,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    // footer that links to signup
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
    footerText: { color: colors.textMuted },
    link: { color: colors.primary, fontWeight: '700' },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={[
            styles.formContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Logo/Title */}
          <View style={styles.titleContainer}>
            <Image source={require('./assets/vitalsense_logo_only.png')} style={{ width: 80, height: 80 }} />
            <Text style={styles.title}>VitalSense</Text>
          </View>

          {/* Student ID Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Student ID</Text>
            <View
              style={[
                styles.inputWrapper,
                studentIdFocused && styles.inputWrapperFocused,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={studentIdFocused ? colors.primary : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter student ID"
                placeholderTextColor={colors.textMuted}
                value={studentId}
                onChangeText={setStudentId}
                onFocus={() => setStudentIdFocused(true)}
                onBlur={() => setStudentIdFocused(false)}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.inputWrapper,
                passwordFocused && styles.inputWrapperFocused,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={passwordFocused ? colors.primary : colors.textMuted}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Enter password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            onPress={handleLogin}
            activeOpacity={0.85}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>

          {/* No account -> Sign up */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>No account?</Text>
            <TouchableOpacity
              onPress={() =>
                typeof onNavigate === 'function'
                  ? onNavigate('Signup')
                  : console.log('Navigate to Signup')
              }
            >
              <Text style={styles.link}> Sign up</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

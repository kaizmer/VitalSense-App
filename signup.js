import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';

// Supabase REST config (match whatever you use in other files)
const SUPABASE_URL = 'https://dftmxaoxygilbhbonrnu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YyxtmFa4_omJeaejR6S3gA_D6f1Ycs0';

export default function Signup({ onNavigate }) {
  const { colors } = useTheme();

  const [studentId, setStudentId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [yearLevelId, setYearLevelId] = useState('');
  const [programId, setProgramId] = useState('');
  const [loading, setLoading] = useState(false);
  const [hidePassword, setHidePassword] = useState(true);

  // Add state for dropdowns
  const [yearLevels, setYearLevels] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch year levels and programs on mount
  useEffect(() => {
    const fetchDropdownData = async () => {
      setLoadingData(true);
      try {
        // Fetch year levels
        const yearRes = await fetch(`${SUPABASE_URL}/rest/v1/year_level?select=year_level_id,year_level`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });
        if (yearRes.ok) {
          const yearData = await yearRes.json();
          setYearLevels(yearData);
        }

        // Fetch programs with college info
        const progRes = await fetch(`${SUPABASE_URL}/rest/v1/program?select=program_id,program,college:college_id(college)`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });
        if (progRes.ok) {
          const progData = await progRes.json();
          setPrograms(progData);
        }
      } catch (err) {
        console.warn('Error fetching dropdown data', err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchDropdownData();
  }, []);

  const validate = () => {
    if (!studentId.trim() || !firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill student ID, first name, last name, email and password.');
      return false;
    }
    if (isNaN(Number(studentId))) {
      Alert.alert('Invalid student ID', 'Student ID must be numeric.');
      return false;
    }
    
    // Password strength validation
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      Alert.alert('Weak Password', 'Password must contain at least 1 uppercase letter.');
      return false;
    }
    if (!/[0-9]/.test(password)) {
      Alert.alert('Weak Password', 'Password must contain at least 1 number.');
      return false;
    }
    
    return true;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      // 1) Create student record FIRST (consent has FK to students)
      const payload = {
        student_id: Number(studentId),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password: password, // store hashed server-side in production
        email: email.trim().toLowerCase(),
        last_update: new Date().toISOString(),
        contact_number: contactNumber ? Number(contactNumber) : null,
        year_level_id: yearLevelId ? Number(yearLevelId) : null,
        program_id: programId ? Number(programId) : null,
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/students`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        console.warn('Signup failed:', txt);
        let parsed = null;
        try { parsed = JSON.parse(txt); } catch (_) { /* ignore */ }
        
        // Check if error is due to duplicate student ID
        if (parsed && (parsed.code === '23505' || parsed.message?.includes('duplicate') || parsed.message?.includes('unique'))) {
          Alert.alert(
            'Account Already Exists',
            `An account with Student ID ${studentId} already exists.\n\nIf you forgot your password, please contact the administrator:\n\nEmail: vitalsense@outlook.com\nPhone: 09685684836`,
            [{ text: 'OK' }]
          );
          setLoading(false);
          return;
        }
        
        const detailMsg = parsed ? `${parsed.message || ''}${parsed.details ? '\n' + parsed.details : ''}` : txt;
        Alert.alert('Signup error', `Unable to create account:\n${detailMsg}`);
        setLoading(false);
        return;
      }

      // 2) Now create consent record AFTER student exists
      const consentPayload = {
        student_id: Number(studentId),
        timelog: new Date().toISOString(),
        consent_type: true,
      };

      try {
        const consentRes = await fetch(`${SUPABASE_URL}/rest/v1/consent`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(consentPayload),
        });
        if (!consentRes.ok) {
          const txt = await consentRes.text();
          console.warn('Consent creation failed:', txt);
          // Student created but consent failed - you may want to handle this differently
        }
      } catch (e) {
        console.warn('Consent creation error', e);
        // Student created but consent failed
      }

      Alert.alert('Account created', 'Your account was successfully created.', [
        { text: 'OK', onPress: () => { if (typeof onNavigate === 'function') onNavigate('Login'); } },
      ]);
    } catch (err) {
      console.warn('Signup error', err);
      Alert.alert('Error', 'Unexpected error during signup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.textPrimary }]}>Create Account</Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="Student ID"
            placeholderTextColor={colors.textMuted}
            value={studentId}
            keyboardType="numeric"
            onChangeText={setStudentId}
            editable={!loading}
          />
        </View>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="First name"
            placeholderTextColor={colors.textMuted}
            value={firstName}
            onChangeText={setFirstName}
            editable={!loading}
          />
        </View>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="Last name"
            placeholderTextColor={colors.textMuted}
            value={lastName}
            onChangeText={setLastName}
            editable={!loading}
          />
        </View>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.passwordWrap, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { flex: 1, borderWidth: 0, color: colors.textPrimary }]}
              placeholder="Password (min 8 chars, 1 uppercase, 1 number)"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={hidePassword}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setHidePassword(!hidePassword)} style={styles.eye}>
              <Ionicons name={hidePassword ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBackground, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="Contact number"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            value={contactNumber}
            onChangeText={setContactNumber}
            editable={!loading}
          />
        </View>

        {/* Replace inline TextInputs with Pickers */}
        <View style={styles.row}>
          <View style={[styles.pickerWrapper, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Picker
              selectedValue={yearLevelId}
              onValueChange={(itemValue) => setYearLevelId(itemValue)}
              enabled={!loading && !loadingData}
              style={[styles.picker, { color: colors.textPrimary }]}
            >
              <Picker.Item label="Select year level" value="" />
              {yearLevels.map((yl) => (
                <Picker.Item
                  key={yl.year_level_id}
                  label={yl.year_level.replace(/_/g, ' ')}
                  value={yl.year_level_id.toString()}
                />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.row}>
          <View style={[styles.pickerWrapper, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Picker
              selectedValue={programId}
              onValueChange={(itemValue) => setProgramId(itemValue)}
              enabled={!loading && !loadingData}
              style={[styles.picker, { color: colors.textPrimary }]}
            >
              <Picker.Item label="Select program" value="" />
              {programs.map((prog) => (
                <Picker.Item
                  key={prog.program_id}
                  label={`${prog.program}${prog.college ? ` - ${prog.college.college}` : ''}`}
                  value={prog.program_id.toString()}
                />
              ))}
            </Picker>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }, (loading || loadingData) && { opacity: 0.8 }]}
          onPress={handleSignup}
          disabled={loading || loadingData}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign Up</Text>}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Already have an account?</Text>
          <TouchableOpacity onPress={() => typeof onNavigate === 'function' ? onNavigate('Login') : null}>
            <Text style={[styles.link, { color: colors.primary }]}> Log in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, paddingTop: 36 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', marginBottom: 20 },
  row: { marginBottom: 12 },
  rowInline: { flexDirection: 'row', marginBottom: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ECEFF6',
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ECEFF6',
    paddingHorizontal: 8,
  },
  eye: { padding: 8 },
  button: {
    backgroundColor: '#5E35B1',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  footerText: { color: '#6B7280' },
  link: { color: '#5E35B1', fontWeight: '700' },
  pickerWrapper: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ECEFF6',
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
});
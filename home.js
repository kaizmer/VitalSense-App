import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Animated,
  Dimensions,
  Easing,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { emit, subscribe } from './eventBus';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useTheme } from './ThemeContext';

const SIDEBAR_WIDTH = 260;

// add Supabase REST config
const SUPABASE_URL = 'https://dftmxaoxygilbhbonrnu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YyxtmFa4_omJeaejR6S3gA_D6f1Ycs0';

// Ensure notifications are shown when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function Home({ onNavigate, user }) {
  const { colors } = useTheme();
  
  const [selectedMood, setSelectedMood] = useState('Happy');
  const [addingScan, setAddingScan] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(false);
  const [savingMood, setSavingMood] = useState(false);

  // Sidebar state/animation
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = (open) => {
    setSidebarOpen(open);
    Animated.timing(slideAnim, {
      toValue: open ? 0 : -SIDEBAR_WIDTH,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleMenuItem = (route, params = null) => {
    toggleSidebar(false);
    if (typeof onNavigate === 'function') {
      // small delay so the animation can start/finish smoothly
      setTimeout(() => onNavigate(route, params), 220);
    }
  };

  const vitalScans = [
    {
      id: 1,
      type: 'Blood Pressure',
      icon: 'heart',
      iconColor: '#EC407A',
      bgColor: '#FCE4EC',
      value: '140/90',
      unit: 'mmHg',
      timestamp: 'Fri, Nov 14, 2025 • 2:40 PM',
      status: 'elevated',
    },
    {
      id: 2,
      type: 'Temperature',
      icon: 'thermometer',
      iconColor: '#EF5350',
      bgColor: '#FFEBEE',
      value: '38.5',
      unit: '°C',
      timestamp: 'Fri, Nov 14, 2025 • 2:40 PM',
      status: 'high',
    },
    {
      id: 3,
      type: 'Heart Rate',
      icon: 'pulse',
      iconColor: '#E53935',
      bgColor: '#FFEBEE',
      value: '110',
      unit: 'bpm',
      timestamp: 'Fri, Nov 14, 2025 • 2:40 PM',
      status: 'elevated',
    },
  ];

  const moods = [
    { emoji: '😊', label: 'Happy' },
    { emoji: '😢', label: 'Sad' },
    { emoji: '😴', label: 'Tired' },
    { emoji: '😰', label: 'Anxious' },
    { emoji: '😌', label: 'Calm' },
  ];

  const [latestRecord, setLatestRecord] = useState(null);
  const [latestLoading, setLatestLoading] = useState(false);
  const [latestMood, setLatestMood] = useState(null);

  // reusable fetchLatest so we can call after inserting a random scan
  const fetchLatest = async () => {
    if (!user || !user.studentId) return;
    setLatestLoading(true);
    try {
      // First get consent_id(s) for the student
      const consentUrl = `${SUPABASE_URL}/rest/v1/consent?select=consent_id&student_id=eq.${user.studentId}`;
      const consentRes = await fetch(consentUrl, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json',
        },
      });
      if (!consentRes.ok) {
        console.warn('Failed fetching consent', await consentRes.text());
        setLatestRecord(null);
        return;
      }
      const consents = await consentRes.json();
      if (!Array.isArray(consents) || consents.length === 0) {
        setLatestRecord(null);
        return;
      }
      
      const consentIds = consents.map(c => c.consent_id).join(',');
      
      // Fetch latest vitals using consent_id(s)
      const url = `${SUPABASE_URL}/rest/v1/vitals?select=vitals_id,consent_id,timelog,temperature,heart_rate,systolic,diastolic&consent_id=in.(${consentIds})&order=vitals_id.desc&limit=1`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        console.warn('Failed fetching latest vitals', await res.text());
        setLatestRecord(null);
        return;
      }
      const rows = await res.json();
      const vital = Array.isArray(rows) && rows.length ? rows[0] : null;
      if (vital) {
        // Transform to match old structure for UI compatibility
        setLatestRecord({
          record_id: vital.vitals_id,
          record_at: vital.timelog,
          temperature: vital.temperature,
          heart_rate: vital.heart_rate,
          blood_pressure: vital.diastolic ? `${vital.systolic}/${vital.diastolic}` : `${vital.systolic}`,
          mood_level: 'N/A', // mood not in vitals table
        });
      } else {
        setLatestRecord(null);
      }
    } catch (err) {
      console.warn('Error fetching latest record', err);
      setLatestRecord(null);
    } finally {
      setLatestLoading(false);
    }
  };

  // Fetch latest mood from database
  const fetchLatestMood = async () => {
    if (!user || !user.studentId) return;
    try {
      // First get consent_id(s) for the student
      const consentUrl = `${SUPABASE_URL}/rest/v1/consent?select=consent_id&student_id=eq.${user.studentId}`;
      const consentRes = await fetch(consentUrl, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json',
        },
      });
      if (!consentRes.ok) {
        console.warn('Failed fetching consent for mood', await consentRes.text());
        return;
      }
      const consents = await consentRes.json();
      if (!Array.isArray(consents) || consents.length === 0) {
        return;
      }
      
      const consentIds = consents.map(c => c.consent_id).join(',');
      
      // Fetch latest mood using consent_id(s)
      const url = `${SUPABASE_URL}/rest/v1/mood?select=mood_id,mood_level,timelog&consent_id=in.(${consentIds})&order=mood_id.desc&limit=1`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        console.warn('Failed fetching latest mood', await res.text());
        return;
      }
      const rows = await res.json();
      const mood = Array.isArray(rows) && rows.length ? rows[0] : null;
      if (mood) {
        // Map mood_level number to mood label
        const moodMap = {
          1: 'Happy',
          2: 'Sad',
          3: 'Tired',
          4: 'Anxious',
          5: 'Calm',
        };
        setLatestMood({
          mood_id: mood.mood_id,
          mood_level: mood.mood_level,
          mood_label: moodMap[mood.mood_level] || 'Happy',
          timelog: mood.timelog,
        });
        setSelectedMood(moodMap[mood.mood_level] || 'Happy');
      }
    } catch (err) {
      console.warn('Error fetching latest mood', err);
    }
  };

  useEffect(() => {
    fetchLatest();
    fetchLatestMood();
  }, [user]);

  // request permission & setup channel (runs once)
  useEffect(() => {
    (async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.warn('Notifications permission not granted');
          Alert.alert('Notifications disabled', 'Enable notifications in system settings to receive scan alerts.');
          return;
        }
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('scans', {
            name: 'Scan notifications',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            enableLights: true,
          });
        }
      } catch (e) {
        console.warn('Notification setup error', e);
      }
    })();
  }, []);

  // navigate to Notifications when a notification is tapped
  useEffect(() => {
    if (typeof onNavigate !== 'function') return;

    // handle responses while app is running / backgrounded
    const respSub = Notifications.addNotificationResponseReceivedListener(response => {
      try {
        console.log('Notification tapped -> navigating to Notifications', response);
        onNavigate('Notifications');
      } catch (e) {
        console.warn('Handle notification response error', e);
      }
    });

    // handle case where app was launched from a notification (cold start)
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) {
          console.log('App opened from notification -> navigating to Notifications', last);
          onNavigate('Notifications');
        }
      } catch (e) {
        console.warn('Error checking last notification response', e);
      }
    })();

    return () => {
      try { respSub.remove(); } catch (_) { /* ignore */ }
    };
  }, [onNavigate]);

  // helper: send immediate local notification for a created scan
  const sendLocalNotification = async (row) => {
    try {
      if (!row) return;
      const temp = Number(row.temperature);
      const hr = Number(row.heart_rate);
      const bp = String(row.blood_pressure || '');
      const parts = bp.split('/');
      const sys = parseFloat(parts[0]);
      const dia = parts.length > 1 ? parseFloat(parts[1]) : NaN;
      const highBP = Number.isFinite(sys) && Number.isFinite(dia) && (sys > 130 || dia > 80);
      const highTemp = Number.isFinite(temp) && temp > 38.0;
      const highHR = Number.isFinite(hr) && hr > 100;

      const title = (highBP || highTemp || highHR) ? 'Warning: Abnormal Scan' : 'New Scan Recorded';
      const body = `Temp ${temp}°C • BP ${bp} • HR ${hr} bpm`;

      // schedule with a 1 second trigger to ensure delivery on most devices
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { record_id: row.record_id },
          sound: 'default',
          channelId: Platform.OS === 'android' ? 'scans' : undefined,
        },
        trigger: { seconds: 1 },
      });
      console.log('Local notification scheduled, id=', id);
    } catch (e) {
      console.warn('Failed to send local notification', e);
    }
  };

  // helper: numeric random
  const rand = (min, max) => Math.round((Math.random() * (max - min) + min) * 10) / 10;

  // add a random scan record for the logged in user
  const addRandomScan = async () => {
    if (!user || !user.studentId) {
      Alert.alert('Not logged in', 'Please log in to add a scan.');
      return;
    }
    setAddingScan(true);
    try {
      // Get consent_id for the student
      const consentUrl = `${SUPABASE_URL}/rest/v1/consent?select=consent_id&student_id=eq.${user.studentId}&limit=1`;
      const consentRes = await fetch(consentUrl, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json',
        },
      });
      if (!consentRes.ok) {
        Alert.alert('Error', 'Unable to find consent record.');
        setAddingScan(false);
        return;
      }
      const consents = await consentRes.json();
      if (!Array.isArray(consents) || consents.length === 0) {
        Alert.alert('Error', 'No consent record found. Please complete consent first.');
        setAddingScan(false);
        return;
      }
      const consentId = consents[0].consent_id;

      // Randomly choose between normal and abnormal readings (50/50 chance)
      const isAbnormal = Math.random() < 0.5;

      let temp, hr, sys, dia;
      
      if (isAbnormal) {
        // Generate abnormal readings
        const abnormalType = Math.floor(Math.random() * 3); // 0: high temp, 1: high BP, 2: high HR
        
        switch (abnormalType) {
          case 0: // High temperature
            temp = rand(38.5, 40.0);
            hr = Math.round(rand(75, 95));
            sys = Math.round(rand(115, 125));
            dia = Math.round(rand(70, 80));
            break;
          case 1: // High blood pressure
            temp = rand(36.5, 37.5);
            hr = Math.round(rand(75, 95));
            sys = Math.round(rand(140, 160));
            dia = Math.round(rand(90, 100));
            break;
          case 2: // High heart rate
            temp = rand(36.5, 37.5);
            hr = Math.round(rand(110, 130));
            sys = Math.round(rand(115, 125));
            dia = Math.round(rand(70, 80));
            break;
          default:
            // Multiple abnormal readings
            temp = rand(38.5, 39.5);
            hr = Math.round(rand(105, 125));
            sys = Math.round(rand(140, 155));
            dia = Math.round(rand(88, 98));
        }
      } else {
        // Generate normal readings
        temp = rand(36.0, 37.5);
        hr = Math.round(rand(60, 90));
        sys = Math.round(rand(110, 125));
        dia = Math.round(rand(65, 80));
      }

      const now = new Date().toISOString();

      const record = {
        consent_id: consentId,
        timelog: now,
        temperature: temp,
        heart_rate: hr,
        systolic: sys,
        diastolic: dia,
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/vitals`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.warn('Failed inserting vitals', txt);
        Alert.alert('Error', 'Unable to add scan. See console for details.');
        return;
      }
      const created = await res.json();
      const createdRow = Array.isArray(created) && created.length ? created[0] : null;
      if (createdRow) {
        if (!createdRow.timelog) createdRow.timelog = now;
        createdRow.temperature = Number(createdRow.temperature);
        createdRow.heart_rate = Number(createdRow.heart_rate);
        createdRow.systolic = Number(createdRow.systolic);
        createdRow.diastolic = createdRow.diastolic ? Number(createdRow.diastolic) : null;
        
        // Transform for UI
        const transformed = {
          record_id: createdRow.vitals_id,
          record_at: createdRow.timelog,
          temperature: createdRow.temperature,
          heart_rate: createdRow.heart_rate,
          blood_pressure: createdRow.diastolic ? `${createdRow.systolic}/${createdRow.diastolic}` : `${createdRow.systolic}`,
          mood_level: 'N/A',
        };
        
        console.log('Created scan:', createdRow, isAbnormal ? '(ABNORMAL)' : '(NORMAL)');
        setLatestRecord(transformed);
        try { emit('scan:added', transformed); } catch (e) { console.warn(e); }
        sendLocalNotification(transformed);
        fetchLatest();
        Alert.alert(
          'Scan added', 
          `A ${isAbnormal ? 'abnormal' : 'normal'} scan was added to your records.`
        );
      } else {
        Alert.alert('Scan added', 'Record added but no response returned.');
      }
    } catch (err) {
      console.warn('Error adding random scan', err);
      Alert.alert('Error', 'Unexpected error while adding scan.');
    } finally {
      setAddingScan(false);
    }
  };

  // Handle mood change with confirmation
  const handleMoodChange = (moodLabel) => {
    if (moodLabel === selectedMood) return; // No change
    
    Alert.alert(
      'Change Mood',
      `Are you sure you want to change your mood to "${moodLabel}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm',
          onPress: () => saveMood(moodLabel),
        },
      ],
    );
  };

  // Save mood to database
  const saveMood = async (moodLabel) => {
    if (!user || !user.studentId) {
      Alert.alert('Not logged in', 'Please log in to save your mood.');
      return;
    }
    setSavingMood(true);
    try {
      // Get consent_id for the student
      const consentUrl = `${SUPABASE_URL}/rest/v1/consent?select=consent_id&student_id=eq.${user.studentId}&limit=1`;
      const consentRes = await fetch(consentUrl, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json',
        },
      });
      if (!consentRes.ok) {
        Alert.alert('Error', 'Unable to find consent record.');
        setSavingMood(false);
        return;
      }
      const consents = await consentRes.json();
      if (!Array.isArray(consents) || consents.length === 0) {
        Alert.alert('Error', 'No consent record found. Please complete consent first.');
        setSavingMood(false);
        return;
      }
      const consentId = consents[0].consent_id;

      // Map mood label to numeric level
      const moodLevelMap = {
        'Happy': 1,
        'Sad': 2,
        'Tired': 3,
        'Anxious': 4,
        'Calm': 5,
      };
      const moodLevel = moodLevelMap[moodLabel] || 1;

      const now = new Date().toISOString();

      const record = {
        consent_id: consentId,
        timelog: now,
        mood_level: moodLevel,
      };

      const res = await fetch(`${SUPABASE_URL}/rest/v1/mood`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) {
        const txt = await res.text();
        console.warn('Failed inserting mood', txt);
        Alert.alert('Error', 'Unable to save mood. See console for details.');
        return;
      }
      const created = await res.json();
      const createdRow = Array.isArray(created) && created.length ? created[0] : null;
      if (createdRow) {
        console.log('Mood saved:', createdRow);
        setSelectedMood(moodLabel);
        setLatestMood({
          mood_id: createdRow.mood_id,
          mood_level: createdRow.mood_level,
          mood_label: moodLabel,
          timelog: createdRow.timelog,
        });
        // Optional: Show success message
        Alert.alert('Success', `Your mood has been updated to "${moodLabel}".`);
      }
    } catch (err) {
      console.warn('Error saving mood', err);
      Alert.alert('Error', 'Unexpected error while saving mood.');
    } finally {
      setSavingMood(false);
    }
  };

  // build displayed scan cards from latestRecord (useMemo so it updates reactively)
  const displayedScans = React.useMemo(() => {
    const hasAny = Boolean(latestRecord);
    return [
      {
        id: 'bp',
        type: 'Blood Pressure',
        icon: 'heart',
        iconColor: '#EC407A',
        bgColor: '#FCE4EC',
        // show actual value when available, otherwise show friendly message
        value: hasAny && latestRecord?.blood_pressure ? String(latestRecord.blood_pressure) : null,
        unit: 'mmHg',
        timestamp: hasAny && latestRecord?.record_at ? new Date(latestRecord.record_at).toLocaleString() : vitalScans[0].timestamp,
        status: 'elevated',
        hasData: hasAny && Boolean(latestRecord?.blood_pressure),
        emptyMessage: 'No BP record yet — please complete your first scan.',
      },
      {
        id: 'temp',
        type: 'Temperature',
        icon: 'thermometer',
        iconColor: '#EF5350',
        bgColor: '#FFEBEE',
        value: hasAny && latestRecord?.temperature != null ? String(latestRecord.temperature) : null,
        unit: '°C',
        timestamp: hasAny && latestRecord?.record_at ? new Date(latestRecord.record_at).toLocaleString() : vitalScans[1].timestamp,
        status: 'high',
        hasData: hasAny && latestRecord?.temperature != null,
        emptyMessage: 'No temperature record yet — scan at the kiosk.',
      },
      {
        id: 'hr',
        type: 'Heart Rate',
        icon: 'pulse',
        iconColor: '#E53935',
        bgColor: '#FFEBEE',
        value: hasAny && latestRecord?.heart_rate != null ? String(latestRecord.heart_rate) : null,
        unit: 'bpm',
        timestamp: hasAny && latestRecord?.record_at ? new Date(latestRecord.record_at).toLocaleString() : vitalScans[2].timestamp,
        status: 'elevated',
        hasData: hasAny && latestRecord?.heart_rate != null,
        emptyMessage: 'Heart rate data unavailable — visit the kiosk to generate your first reading.',
      },
    ];
  }, [latestRecord, vitalScans]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.background} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.menuButton}
          activeOpacity={0.7}
          onPress={() => toggleSidebar(true)}
        >
          <Ionicons name="menu" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Home</Text>
        <TouchableOpacity
          style={styles.notificationButton}
          activeOpacity={0.7}
          onPress={() => {
            if (typeof onNavigate === 'function') onNavigate('Notifications');
            else console.log('Navigate to Notifications');
          }}
        >
          {hasNotifications && <View style={styles.notificationBadge} />}
          <Ionicons name="notifications-outline" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => toggleSidebar(false)}
          style={styles.overlay}
        />
      )}

      {/* Sidebar */}
      <Animated.View
        style={[
          styles.sidebar,
          { transform: [{ translateX: slideAnim }] },
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.sidebarInner, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.sidebarTitle, { color: colors.primary }]}>Menu</Text>

          <TouchableOpacity
            style={styles.sidebarItem}
            onPress={() => handleMenuItem('Home')}
            activeOpacity={0.7}
          >
            <Ionicons name="grid" size={20} color={colors.primary} />
            <Text style={[styles.sidebarItemText, { color: colors.textPrimary }]}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sidebarItem}
            onPress={() => handleMenuItem('Profile')}
            activeOpacity={0.7}
          >
            <Ionicons name="person" size={20} color={colors.primary} />
            <Text style={[styles.sidebarItemText, { color: colors.textPrimary }]}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sidebarItem}
            onPress={() => handleMenuItem('QR')}
            activeOpacity={0.7}
          >
            <Ionicons name="qr-code" size={20} color={colors.primary} />
            <Text style={[styles.sidebarItemText, { color: colors.textPrimary }]}>Generate QR Code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sidebarItem}
            onPress={() => handleMenuItem('Settings')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings" size={20} color={colors.primary} />
            <Text style={[styles.sidebarItemText, { color: colors.textPrimary }]}>Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sidebarItem}
            onPress={() => handleMenuItem('Trends', { metric: 'all' })}
            activeOpacity={0.7}
          >
            <Ionicons name="trending-up" size={20} color={colors.primary} />
            <Text style={[styles.sidebarItemText, { color: colors.textPrimary }]}>Trends</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sidebarItem}
            onPress={() => handleMenuItem('ScanLogs')}
            activeOpacity={0.7}
          >
            <Ionicons name="clipboard" size={20} color={colors.primary} />
            <Text style={[styles.sidebarItemText, { color: colors.textPrimary }]}>Scan Logs</Text>
          </TouchableOpacity>

          <View style={[styles.sidebarDivider, { backgroundColor: colors.border }]} />

          <TouchableOpacity
            style={styles.sidebarItem}
            onPress={() => handleMenuItem('Login')}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color="#E53935" />
            <Text style={[styles.sidebarItemText, { color: '#E53935' }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* Announcement Card */}
        <View style={[styles.announcementCard, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.announcementIconContainer}>
            <View style={styles.announcementIconCircle}>
              <Ionicons name="megaphone" size={20} color="#fff" />
            </View>
          </View>
          <View style={styles.announcementContent}>
            <Text style={[styles.announcementTitle, { color: colors.primary }]}>Announcement</Text>
            <Text style={[styles.announcementText, { color: colors.textSecondary }]}>
              Finals Week is Coming! Remember to take breaks and monitor your health. Visit the VitalSense kiosk for a quick scan before your study sessions.
            </Text>
          </View>
        </View>

        {/* Latest personal record (from supabase) */}
        {latestRecord && (
          <View style={[styles.announcementCard, { marginBottom: 12, backgroundColor: colors.cardBackground }]}>
            <View style={styles.announcementIconContainer}>
              <View style={[styles.announcementIconCircle, { backgroundColor: '#34D399' }]}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
            </View>
            <View style={styles.announcementContent}>
              <Text style={[styles.announcementTitle, { color: colors.primary }]}>Latest from you</Text>
              <Text style={[styles.announcementText, { color: colors.textSecondary }]}>
                Mood: {latestRecord.mood_level} • Temp: {latestRecord.temperature}°C • HR: {latestRecord.heart_rate} bpm
              </Text>
              <Text style={[styles.announcementText, { marginTop: 6, color: colors.textSecondary }]}>
                BP: {latestRecord.blood_pressure} • {new Date(latestRecord.record_at).toLocaleString()}
              </Text>
            </View>
          </View>
        )}

        {/* General message when no records */}
        {!latestRecord && (
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
              No records available yet. Complete your first VitalSense kiosk scan to view your health data.
            </Text>
          </View>
        )}

        {/* Latest Scan Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Latest Scan</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
          </TouchableOpacity>
        </View>

        {/* Vital Scans (show latestRecord values when present) */}
        {displayedScans.map((scan) => (
          <TouchableOpacity
            key={scan.id}
            style={[styles.vitalCard, { backgroundColor: colors.cardBackground }]}
            activeOpacity={0.8}
            onPress={() => {
              if (!scan.hasData) {
                // show modal/alert as requested when no data for this category
                Alert.alert(
                  scan.type,
                  `You have no data yet for this category.\nPlease complete your first kiosk scan to view your health trends.`,
                  [{ text: 'OK', style: 'cancel' }],
                );
                return;
              }
              if (typeof onNavigate === 'function') {
                onNavigate('Trends', { metric: scan.type });
              } else {
                console.log('Open trends for', scan.type);
              }
            }}
          >
            <View style={[styles.vitalIconContainer, { backgroundColor: scan.bgColor }]}>
              <Ionicons name={scan.icon} size={28} color={scan.iconColor} />
            </View>
            <View style={styles.vitalInfo}>
              <Text style={[styles.vitalType, { color: colors.textPrimary }]}>{scan.type}</Text>
              <Text style={[styles.vitalTimestamp, { color: colors.textMuted }]}>{scan.timestamp}</Text>
            </View>
            <View style={styles.vitalValueContainer}>
              <Text style={[styles.vitalValue, { color: colors.textPrimary }]}>{scan.hasData ? scan.value : '—'}</Text>
              <Text style={[styles.vitalUnit, { color: colors.textSecondary }]}>{scan.unit}</Text>
              {!scan.hasData && (
                <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '500', marginTop: 4 }}>
                  No records yet
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {/* Mood Tracker */}
        <View style={[styles.moodCard, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.moodIconContainer}>
            <Text style={styles.moodIconEmoji}>
              {moods.find(m => m.label === selectedMood)?.emoji || '😊'}
            </Text>
          </View>
          <View style={styles.moodContent}>
            <Text style={[styles.moodTitle, { color: colors.textPrimary }]}>Mood</Text>
            <Text style={[styles.moodTimestamp, { color: colors.textMuted }]}>
              {latestMood?.timelog 
                ? new Date(latestMood.timelog).toLocaleString() 
                : 'No mood recorded yet'}
            </Text>
            
            <View style={styles.moodSelector}>
              <View style={[styles.currentMoodDisplay, { backgroundColor: colors.border }]}>
                <Text style={[styles.currentMoodEmoji, { color: colors.textPrimary }]}>
                  {moods.find(m => m.label === selectedMood)?.emoji || '😊'}
                </Text>
                <Text style={[styles.currentMoodText, { color: colors.textPrimary }]}>{selectedMood}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </View>
            </View>

            {/* Mood Options */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.moodOptions}
            >
              {moods.map((mood) => (
                <TouchableOpacity
                  key={mood.label}
                  style={[
                    styles.moodOption,
                    { backgroundColor: colors.border },
                    selectedMood === mood.label && styles.moodOptionSelected,
                  ]}
                  onPress={() => handleMoodChange(mood.label)}
                  activeOpacity={0.7}
                  disabled={savingMood}
                >
                  <Text style={styles.moodOptionEmoji}>{mood.emoji}</Text>
                  <Text style={[
                    styles.moodOptionLabel,
                    { color: colors.textSecondary },
                    selectedMood === mood.label && { color: colors.primary },
                  ]}>
                    {mood.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {savingMood && (
              <View style={{ marginTop: 8, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>
                  Saving mood...
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Add Scan Button */}
        <TouchableOpacity
          style={[styles.addScanButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={addRandomScan}
          disabled={addingScan}
        >
          <View style={styles.addScanButtonContent}>
            {addingScan ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="add-circle-outline" size={24} color="#fff" />
            )
            }
            <Text style={[styles.addScanText, { marginLeft: addingScan ? 8 : 8 }]}>
              {addingScan ? 'Adding...' : 'Add New Scan'}
            </Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: StatusBar.currentHeight || 16,
    backgroundColor: '#F8F9FA',
  },
  menuButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  notificationButton: {
    padding: 4,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E53935',
    zIndex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 8,
  },
  announcementCard: {
    flexDirection: 'row',
    backgroundColor: '#EDE7F6',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#5E35B1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  announcementIconContainer: {
    marginRight: 12,
    paddingTop: 2,
  },
  announcementIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5E35B1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  announcementContent: {
    flex: 1,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5E35B1',
    marginBottom: 4,
  },
  announcementText: {
    fontSize: 13,
    color: '#424242',
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212121',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5E35B1',
  },
  vitalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  vitalIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  vitalInfo: {
    flex: 1,
  },
  vitalType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  vitalTimestamp: {
    fontSize: 12,
    color: '#9E9E9E',
  },
  vitalValueContainer: {
    alignItems: 'flex-end',
  },
  vitalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#212121',
  },
  vitalUnit: {
    fontSize: 13,
    color: '#757575',
    fontWeight: '600',
    marginTop: 2,
  },
  moodCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  moodIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#FFF9C4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  moodIconEmoji: {
    fontSize: 32,
  },
  moodContent: {
    flex: 1,
  },
  moodTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#212121',
    marginBottom: 4,
  },
  moodTimestamp: {
    fontSize: 12,
    color: '#9E9E9E',
    marginBottom: 12,
  },
  moodSelector: {
    marginBottom: 12,
  },
  currentMoodDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  currentMoodEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  currentMoodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#212121',
    marginRight: 4,
  },
  moodOptions: {
    marginTop: 4,
  },
  moodOption: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    minWidth: 70,
  },
  moodOptionSelected: {
    backgroundColor: '#EDE7F6',
  },
  moodOptionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  moodOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#757575',
  },
  moodOptionLabelSelected: {
    color: '#5E35B1',
  },
  addScanButton: {
    borderRadius: 16,
    backgroundColor: '#5E35B1',
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#5E35B1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  addScanButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  addScanText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  // overlay that dims the content when sidebar is open
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 20,
    paddingTop: 40,
  },
  sidebarInner: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderColor: '#ECE8F6',
    borderWidth: 1,
    shadowColor: '#5E35B1',
    shadowOpacity: 0.06,
    elevation: 6,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#5E35B1',
    marginBottom: 12,
    paddingLeft: 4,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 10,
    marginBottom: 6,
  },
  sidebarItemText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: '#F2F0F8',
    marginVertical: 12,
    borderRadius: 2,
  },
});

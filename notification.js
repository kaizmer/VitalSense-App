import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { subscribe, emit } from './eventBus';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from './ThemeContext';
import { ActivityLogger } from './activityLogger';

// add Supabase REST config (replace with your values or env in production)
const SUPABASE_URL = 'https://dftmxaoxygilbhbonrnu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YyxtmFa4_omJeaejR6S3gA_D6f1Ycs0';

export default function HealthNotifications({ onNavigate, onBack, user }) {
  const { colors, isDarkMode } = useTheme();

  // Log viewing notifications activity
  useEffect(() => {
    if (user && user.studentId) {
      ActivityLogger.viewNotifications(user.studentId);
    }
  }, [user]);

  const [filter, setFilter] = useState('all');

  // dynamic state: fetched records, computed warnings, scannedToday, loading
  const [records, setRecords] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [newScans, setNewScans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scannedToday, setScannedToday] = useState(false);
  // add dismissed state
  const [dismissedIds, setDismissedIds] = useState([]);
  const dismissedRef = useRef(dismissedIds);
  useEffect(() => { dismissedRef.current = dismissedIds; }, [dismissedIds]);

  const STORAGE_KEY = 'vitalsense:dismissedWarnings';

  // load dismissed ids on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setDismissedIds(parsed);
        }
      } catch (err) {
        console.warn('load dismissed ids error', err);
      }
    })();
  }, []);

  // helper: parse BP "120/80" -> { sys, dia }
  const parseBP = (bp) => {
    if (!bp) return { sys: NaN, dia: NaN };
    try {
      const parts = String(bp).split('/');
      const sys = parseFloat(parts[0]);
      const dia = parts.length > 1 ? parseFloat(parts[1]) : NaN;
      return { sys, dia };
    } catch {
      return { sys: NaN, dia: NaN };
    }
  };

  // Helper function to check if vitals are abnormal with correct ranges
  const isAbnormal = (temp, hr, sys, dia) => {
    // Temperature: Normal range 36.1°C - 37.2°C (fever if > 37.5°C)
    const highTemp = Number.isFinite(temp) && temp > 37.5;
    
    // Heart Rate: Normal range 60-100 bpm
    const abnormalHR = Number.isFinite(hr) && (hr < 60 || hr > 100);
    
    // Blood Pressure: Normal systolic < 120, diastolic < 80
    // Elevated: systolic 120-129, diastolic < 80
    // High (Stage 1): systolic 130-139 or diastolic 80-89
    // High (Stage 2): systolic ≥ 140 or diastolic ≥ 90
    const highBP = Number.isFinite(sys) && Number.isFinite(dia) && (sys >= 130 || dia >= 80);
    
    return { highTemp, abnormalHR, highBP };
  };

  // fetch recent records for user and compute warnings + scannedToday
  useEffect(() => {
    let mounted = true;
    const fetchRecords = async () => {
      if (!user || !user.studentId) {
        setRecords([]);
        setWarnings([]);
        setScannedToday(false);
        setNewScans([]);
        return;
      }
      setLoading(true);
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
          if (!mounted) return;
          setRecords([]);
          setWarnings([]);
          setScannedToday(false);
          return;
        }
        const consents = await consentRes.json();
        if (!Array.isArray(consents) || consents.length === 0) {
          if (!mounted) return;
          setRecords([]);
          setWarnings([]);
          setScannedToday(false);
          return;
        }
        
        const consentIds = consents.map(c => c.consent_id).join(',');
        
        // Fetch vitals using consent_id(s) - last 100 records
        const url = `${SUPABASE_URL}/rest/v1/vitals?select=vitals_id,consent_id,timelog,temperature,heart_rate,systolic,diastolic&consent_id=in.(${consentIds})&order=timelog.desc&limit=100`;
        const res = await fetch(url, {
          method: 'GET',
          headers:
           {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok) {
          console.warn('Failed fetching vitals', await res.text());
          if (!mounted) return;
          setRecords([]);
          setWarnings([]);
          setScannedToday(false);
          return;
        }
        const rows = await res.json();
        if (!mounted) return;

        // Transform vitals to match old structure for UI compatibility
        const rowsAll = (Array.isArray(rows) ? rows : []).map(r => ({
          record_id: r.vitals_id,
          record_at: r.timelog,
          temperature: r.temperature,
          heart_rate: r.heart_rate,
          blood_pressure: r.diastolic ? `${r.systolic}/${r.diastolic}` : `${r.systolic}`,
          systolic: r.systolic,
          diastolic: r.diastolic,
        }));

        // filter out dismissed ids so they do not reappear
        const rowsFiltered = rowsAll.filter(r => {
          const id = r.record_id ?? `${r.record_at}`;
          return !dismissedRef.current.includes(id);
        });

        setRecords(rowsFiltered);

        // recent detection should also ignore dismissed
        const FIVE_MIN = 5 * 60 * 1000;
        const now = Date.now();
        const recent = rowsFiltered.filter(r => {
          try {
            const t = Date.parse(r.record_at);
            return Number.isFinite(t) && (now - t) <= FIVE_MIN;
          } catch { return false; }
        }).slice(0, 6);
        if (recent.length > 0) {
          setNewScans(recent);
        } else {
          setNewScans([]);
        }

        // compute scannedToday from all rows (keeps reminder accurate)
        const todayStr = new Date().toDateString();
        const hasScanToday = rowsAll.some(r => {
          try { return new Date(r.record_at).toDateString() === todayStr; } catch { return false; }
        });
        setScannedToday(Boolean(hasScanToday));

        // compute warnings from filtered rows with CORRECT thresholds
        const computed = rowsFiltered.filter((r) => {
          const temp = Number(r.temperature);
          const hr = Number(r.heart_rate);
          const sys = Number(r.systolic);
          const dia = Number(r.diastolic);
          const { highTemp, abnormalHR, highBP } = isAbnormal(temp, hr, sys, dia);
          return highTemp || abnormalHR || highBP;
        }).map((r) => {
          const temp = Number(r.temperature);
          const hr = Number(r.heart_rate);
          const sys = Number(r.systolic);
          const dia = Number(r.diastolic);
          const { highTemp, abnormalHR, highBP } = isAbnormal(temp, hr, sys, dia);
          
          return {
            id: r.record_id ?? `${r.record_at}`,
            temp: r.temperature,
            bp: r.blood_pressure,
            hr: r.heart_rate,
            date: new Date(r.record_at).toLocaleString(),
            flags: {
              highBP,
              highTemp,
              highHR: abnormalHR,
            },
            raw: r,
          };
        });

        setWarnings(computed);
      } catch (err) {
        console.warn('Error fetching vitals', err);
        if (!mounted) return;
        setRecords([]);
        setWarnings([]);
        setScannedToday(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchRecords();

    // subscribe to new scan events for real-time updates
    const unsub = subscribe('scan:added', (row) => {
      try {
        if (!row) return;
        
        const transformed = {
          record_id: row.vitals_id || row.record_id,
          record_at: row.timelog || row.record_at,
          temperature: row.temperature,
          heart_rate: row.heart_rate,
          blood_pressure: row.diastolic ? `${row.systolic}/${row.diastolic}` : `${row.systolic}`,
          systolic: row.systolic,
          diastolic: row.diastolic,
        };
        
        const id = transformed.record_id ?? `${transformed.record_at}`;
        if (dismissedRef.current.includes(id)) return;

        setRecords((prev = []) => {
          const next = [transformed, ...prev];
          const todayStr = new Date().toDateString();
          setScannedToday(Boolean(next.some(r => new Date(r.record_at).toDateString() === todayStr)));

          // recompute warnings with CORRECT thresholds
          const computeWarnings = (rows) => {
            const parsed = (rows || []).filter((r) => {
              const temp = Number(r.temperature);
              const hr = Number(r.heart_rate);
              const sys = Number(r.systolic);
              const dia = Number(r.diastolic);
              const { highTemp, abnormalHR, highBP } = isAbnormal(temp, hr, sys, dia);
              return highTemp || abnormalHR || highBP;
            }).map((r) => {
              const temp = Number(r.temperature);
              const hr = Number(r.heart_rate);
              const sys = Number(r.systolic);
              const dia = Number(r.diastolic);
              const { highTemp, abnormalHR, highBP } = isAbnormal(temp, hr, sys, dia);
              
              return {
                id: r.record_id ?? `${r.record_at}`,
                temp: r.temperature,
                bp: r.blood_pressure,
                hr: r.heart_rate,
                date: new Date(r.record_at).toLocaleString(),
                flags: {
                  highBP,
                  highTemp,
                  highHR: abnormalHR,
                },
                raw: r,
              };
            });
            return parsed;
          };

          const newWarnings = computeWarnings(next);
          setWarnings(newWarnings);
          setNewScans(prevNew => [transformed, ...prevNew].slice(0, 6));
          return next;
        });
      } catch (err) {
        console.warn('scan:added handler error', err);
      }
    });

    return () => { mounted = false; unsub(); };
  }, [user]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      console.log('Hardware back pressed in Notifications');
      if (typeof onNavigate === 'function') {
        onNavigate('Home');
        return true;
      } else if (typeof onBack === 'function') {
        onBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [onBack, onNavigate]);

  // render: if loading show spinner; tabs remain same
  // Show all warnings regardless of filter
  const filteredWarnings = warnings;

  return (
    <LinearGradient
      colors={isDarkMode ? ['#0B1120', '#1E293B', '#0B1120'] : ['#EEF2FF', '#F5E8FF', '#FFF1F6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.background}
    >
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.headerWrap, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.headerInner}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                style={styles.iconTouch}
                onPress={() => {
                  console.log('Notifications back pressed');
                  if (typeof onNavigate === 'function') {
                    onNavigate('Home');
                  } else if (typeof onBack === 'function') {
                    onBack();
                  }
                }}
              >
                <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
              </TouchableOpacity>

              <View style={styles.titleBlock}>
                <LinearGradient
                  colors={['#7C3AED', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.badgeGradient}
                >
                  <Ionicons name="notifications" size={16} color="#fff" />
                </LinearGradient>
                <Text style={[styles.headerTitle, { color: colors.primary }]}>  Notifications</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.iconTouch}
              onPress={() => {
                // manual refresh
                if (user && user.studentId) {
                  setLoading(true);
                  // trigger fetch by changing user reference (call effect helper directly)
                  (async () => {
                    try {
                      // Get consent IDs
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
                        setRecords([]);
                        setWarnings([]);
                        setScannedToday(false);
                        return;
                      }
                      const consents = await consentRes.json();
                      if (!Array.isArray(consents) || consents.length === 0) {
                        setRecords([]);
                        setWarnings([]);
                        setScannedToday(false);
                        return;
                      }
                      
                      const consentIds = consents.map(c => c.consent_id).join(',');
                      
                      // Fetch vitals
                      const url = `${SUPABASE_URL}/rest/v1/vitals?select=vitals_id,consent_id,timelog,temperature,heart_rate,systolic,diastolic&consent_id=in.(${consentIds})&order=timelog.desc&limit=100`;
                      const res = await fetch(url, {
                        method: 'GET',
                        headers: {
                          apikey: SUPABASE_ANON_KEY,
                          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                          Accept: 'application/json',
                        },
                      });
                      if (!res.ok) {
                        console.warn('Failed fetching vitals', await res.text());
                        setRecords([]);
                        setWarnings([]);
                        setScannedToday(false);
                        return;
                      }
                      const rows = await res.json();
                      
                      // Transform
                      const transformed = (Array.isArray(rows) ? rows : []).map(r => ({
                        record_id: r.vitals_id,
                        record_at: r.timelog,
                        temperature: r.temperature,
                        heart_rate: r.heart_rate,
                        blood_pressure: r.diastolic ? `${r.systolic}/${r.diastolic}` : `${r.systolic}`,
                      }));
                      
                      setRecords(transformed);
                      const todayStr = new Date().toDateString();
                      setScannedToday(transformed.some(r => new Date(r.record_at).toDateString() === todayStr));
                      
                      const computed = transformed.filter((r) => {
                        const temp = Number(r.temperature);
                        const hr = Number(r.heart_rate);
                        const bp = r.blood_pressure;
                        const parts = String(bp || '').split('/');
                        const sys = parseFloat(parts[0]);
                        const dia = parts.length>1 ? parseFloat(parts[1]) : NaN;
                        const highBP = Number.isFinite(sys) && Number.isFinite(dia) && (sys > 130 || dia > 80);
                        const highTemp = Number.isFinite(temp) && temp > 38.0;
                        const highHR = Number.isFinite(hr) && hr > 100;
                        return highBP || highTemp || highHR;
                      }).map((r) => ({
                        id: r.record_id ?? `${r.record_at}`,
                        temp: r.temperature,
                        bp: r.blood_pressure,
                        hr: r.heart_rate,
                        date: new Date(r.record_at).toLocaleString(),
                        flags: {
                          highBP: (() => { const p=String(r.blood_pressure).split('/'); const s=parseFloat(p[0]); const d=parseFloat(p[1]); return Number.isFinite(s)&&Number.isFinite(d)&&(s>130||d>80); })(),
                          highTemp: Number(r.temperature) > 38.0,
                          highHR: Number(r.heart_rate) > 100,
                        },
                        raw: r,
                      }));
                      setWarnings(computed);
                    } catch (err) {
                      console.warn('Error refreshing vitals', err);
                    } finally {
                      setLoading(false);
                    }
                  })();
                } else {
                  Alert.alert('No user', 'Please log in to load notifications.');
                }
              }}
            >
              <Ionicons name="refresh" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

          {/* New scans (real-time) - always visible at the top */}
          {newScans.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>New Scans</Text>
                <TouchableOpacity onPress={() => setNewScans([])} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Clear</Text>
                </TouchableOpacity>
              </View>
              {newScans.map((s) => (
                <View key={s.record_id ?? s.record_at} style={[styles.warningCard, { borderColor: colors.border, backgroundColor: colors.cardBackground }]}>
                  <View style={[styles.warningIcon, { backgroundColor: '#06B6D4' }]}>
                    <Ionicons name="pulse" size={18} color="#fff" />
                  </View>
                  <View style={styles.warningBody}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>Recent Scan</Text>
                    <View style={styles.vitalsRow}>
                      <View style={styles.vitalPill}><Text style={styles.vitalLabel}>Temp:</Text><Text style={styles.vitalValue}> {s.temperature}°C</Text></View>
                      <View style={styles.vitalPill}><Text style={styles.vitalLabel}>BP:</Text><Text style={styles.vitalValue}> {s.blood_pressure}</Text></View>
                      <View style={styles.vitalPill}><Text style={styles.vitalLabel}>HR:</Text><Text style={styles.vitalValue}> {s.heart_rate} bpm</Text></View>
                    </View>
                    <Text style={[styles.dateText, { color: colors.textSecondary }]}>{new Date(s.record_at).toLocaleString()}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabsRow}>
            {['all', 'warnings', 'reminders'].map((tab) => {
              const selected = filter === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setFilter(tab)}
                  style={[
                    styles.tabButton,
                    selected ? { backgroundColor: colors.primary } : { backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border }
                  ]}
                >
                  <Text style={[styles.tabText, { color: selected ? '#fff' : colors.textSecondary }]}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Health Reminder: show only when user hasn't scanned today */}
          {filter !== 'warnings' && (
            <>
              {!loading && !scannedToday && (
                <View style={[styles.reminderCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                  <LinearGradient
                    colors={['#FDE68A', '#FDBA74']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.reminderIcon}
                  >
                    <Ionicons name="heart" size={20} color="#fff" />
                  </LinearGradient>

                  <View style={styles.reminderBody}>
                    <Text style={[styles.reminderTitle, { color: colors.textPrimary }]}>Health Reminder</Text>
                    <Text style={[styles.reminderText, { color: colors.textSecondary }]}>
                      You haven't scanned your vitals today. Please scan now.
                    </Text>

                    <TouchableOpacity
                      style={styles.scanButton}
                      onPress={() => {
                        if (typeof onNavigate === 'function') onNavigate('Home');
                        else Alert.alert('Scan', 'Scan flow not implemented');
                      }}
                    >
                      <LinearGradient
                        colors={['#7C3AED', '#EC4899']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.scanGradient}
                      >
                        <Text style={styles.scanText}>Scan Now</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {loading && (
                <View style={{ padding: 12, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#7C3AED" />
                </View>
              )}
            </>
          )}

          {/* Warnings */}
          {filter !== 'reminders' && (
            <View style={styles.warningsSection}>
              <View style={styles.warningsHeader}>
                <View style={styles.warningsTitleRow}>
                  <View style={styles.warningBadge}>
                    <Ionicons name="alert-circle" size={18} color="#fff" />
                  </View>
                  <Text style={[styles.warningsTitle, { color: colors.textPrimary }]}>  Warnings</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{warnings.length}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.warningsList}>
                {loading && (
                  <View style={{ padding: 12, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#EF4444" />
                  </View>
                )}
                {!loading && filteredWarnings.length === 0 && (
                  <View style={{ padding: 12 }}>
                    <Text style={{ color: colors.textSecondary }}>No abnormal records found.</Text>
                  </View>
                )}
                {!loading && filteredWarnings.map((warning) => (
                  <View key={warning.id} style={[styles.warningCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <LinearGradient
                      colors={['#F87171', '#EF4444']}
                      style={styles.warningIcon}
                    >
                      <Ionicons name="alert-circle" size={18} color="#fff" />
                    </LinearGradient>

                    <View style={styles.warningBody}>
                      <Text style={[styles.warningTitle, { color: colors.textPrimary }]}>Abnormal Vital Detected</Text>

                      <View style={styles.vitalsRow}>
                        <View style={styles.vitalPill}>
                          <Text style={styles.vitalLabel}>Temp:</Text>
                          <Text style={styles.vitalValue}> {warning.temp}°C</Text>
                        </View>

                        <View style={styles.vitalPill}>
                          <Text style={styles.vitalLabel}>BP:</Text>
                          <Text style={styles.vitalValue}> {warning.bp}</Text>
                        </View>

                        <View style={styles.vitalPill}>
                          <Text style={styles.vitalLabel}>HR:</Text>
                          <Text style={styles.vitalValue}> {warning.hr} bpm</Text>
                        </View>
                      </View>

                      <View style={styles.dateRow}>
                        <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                        <Text style={[styles.dateText, { color: colors.textSecondary }]}>  {warning.date}</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.viewButton}
                      onPress={() => {
                        try {
                          const abnormal = [];
                          if (warning.flags?.highTemp) abnormal.push('Temperature (fever)');
                          if (warning.flags?.highBP) abnormal.push('Blood Pressure');
                          if (warning.flags?.highHR) abnormal.push('Heart Rate');

                          const message = abnormal.length > 0
                            ? `The following vitals are abnormal:\n\n• ${abnormal.join('\n• ')}\n\nPlease visit the clinic to be checked.`
                            : 'No abnormal vitals detected for this record. If you feel unwell, please consider visiting the clinic.';

                          // Show alert immediately
                          Alert.alert(
                            'Abnormal Vital Detected',
                            message,
                            [{
                              text: 'OK',
                              style: 'cancel',
                              onPress: () => {
                                try {
                                  // persist dismissed id and update state
                                  setDismissedIds(prev => {
                                    const exists = prev.includes(warning.id);
                                    if (exists) return prev;
                                    const next = [...prev, warning.id];
                                    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(e => console.warn('save dismissed error', e));
                                    return next;
                                  });
                                  // remove the viewed warning from warnings (immediate remove from UI)
                                  setWarnings(prev => prev.filter(w => w.id !== warning.id));
                                  // also remove from transient newScans if present
                                  setNewScans(prev => (prev || []).filter(s => {
                                    const sid = s.record_id ?? `${s.record_at}`;
                                    return sid !== warning.id;
                                  }));
                                } catch (e) {
                                  console.warn('dismiss warning error', e);
                                }
                              }
                            }],
                            { cancelable: true }
                          );
                        } catch (err) {
                          console.warn('view warning handler error', err);
                          Alert.alert('View', `Warning ${warning.id}`);
                        }
                      }}
                    >
                      <LinearGradient
                        colors={['#7C3AED', '#EC4899']}
                        style={styles.viewGradient}
                      >
                        <Text style={styles.viewText}>View</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {filter === 'all' && warnings.length > 3 && (
                <TouchableOpacity
                  style={[styles.viewAllButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                  onPress={() => Alert.alert('View All', `Showing all ${warnings.length} warnings`)}
                >
                  <Text style={[styles.viewAllText, { color: colors.textPrimary }]}>View All {warnings.length} Warnings</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  safe: { flex: 1 },

  headerWrap: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#E6E9EE',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    elevation: 2,
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  iconTouch: { padding: 6, borderRadius: 10 },
  titleBlock: { flexDirection: 'row', alignItems: 'center' },
  badgeGradient: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.18,
    elevation: 4,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#5B21B6' },

  container: { padding: 16, paddingBottom: 40 },

  tabsRow: { flexDirection: 'row', marginBottom: 14 },
  tabButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginRight: 8 },
  tabSelected: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.18,
    elevation: 3,
  },
  tabUnselected: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6E9EE' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  tabTextSelected: { color: '#fff' },

  reminderCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3E8FF',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.06,
    elevation: 2,
  },
  reminderIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderBody: { flex: 1, marginLeft: 12 },
  reminderTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 6 },
  reminderText: { fontSize: 14, color: '#4B5563', marginBottom: 10 },
  scanButton: { alignSelf: 'flex-start' },
  scanGradient: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  scanText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  warningsSection: { marginTop: 6 },
  warningsHeader: { marginBottom: 10 },
  warningsTitleRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  warningBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningsTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginLeft: 8 },
  countBadge: {
    marginLeft: 10,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  countText: { fontSize: 12, color: '#B91C1C', fontWeight: '700' },

  warningsList: {},
  warningCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FEEAEA',
    shadowColor: '#EF4444',
    shadowOpacity: 0.03,
    elevation: 2,
  },
  warningIcon: {
    width: 46,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  warningBody: { flex: 1 },
  warningTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  vitalsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 },
  vitalPill: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vitalLabel: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  vitalValue: { fontSize: 13, color: '#B91C1C', fontWeight: '800' },

  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontSize: 12, color: '#6B7280' },

  viewButton: { marginLeft: 8 },
  viewGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewText: { color: '#fff', fontWeight: '800' },

  viewAllButton: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    alignItems: 'center',
  },
  viewAllText: { color: '#374151', fontWeight: '800' },
});

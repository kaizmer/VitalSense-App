import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from './ThemeContext';

const SUPABASE_URL = 'https://dftmxaoxygilbhbonrnu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YyxtmFa4_omJeaejR6S3gA_D6f1Ycs0';

export default function ScanLogs({ onNavigate, onBack, user }) {
  const { colors, isDarkMode } = useTheme();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchScans();
  }, [user]);

  const fetchScans = async () => {
    if (!user || !user.studentId) return;
    setLoading(true);
    try {
      // Get consent_id(s)
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
        setScans([]);
        return;
      }
      const consents = await consentRes.json();
      if (!Array.isArray(consents) || consents.length === 0) {
        setScans([]);
        return;
      }
      
      const consentIds = consents.map(c => c.consent_id).join(',');
      
      // Fetch all vitals
      const url = `${SUPABASE_URL}/rest/v1/vitals?select=vitals_id,consent_id,timelog,temperature,heart_rate,systolic,diastolic&consent_id=in.(${consentIds})&order=timelog.desc`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        console.warn('Failed fetching scans', await res.text());
        setScans([]);
        return;
      }
      const rows = await res.json();
      setScans(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.warn('Error fetching scans', err);
      setScans([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (temp, hr, sys, dia) => {
    const highTemp = temp > 38.0;
    const highHR = hr > 100;
    const highBP = sys > 130 || dia > 80;
    if (highTemp || highHR || highBP) return '#EF4444';
    return '#10B981';
  };

  const getStatusText = (temp, hr, sys, dia) => {
    const highTemp = temp > 38.0;
    const highHR = hr > 100;
    const highBP = sys > 130 || dia > 80;
    if (highTemp || highHR || highBP) return 'Abnormal';
    return 'Normal';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDarkMode ? ['#1F2937', '#111827', '#0F172A'] : ['#EEF2FF', '#F5E8FF', '#FFF1F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => (typeof onBack === 'function' ? onBack() : typeof onNavigate === 'function' && onNavigate('Home'))}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>Scan Logs</Text>
          <TouchableOpacity onPress={fetchScans} style={styles.refreshButton}>
            <Ionicons name="refresh" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading scans...</Text>
            </View>
          ) : scans.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="clipboard-outline" size={64} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Scans Yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Your scan history will appear here once you complete your first VitalSense kiosk scan.
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.countText, { color: colors.textSecondary }]}>
                {scans.length} scan{scans.length !== 1 ? 's' : ''} found
              </Text>
              {scans.map((scan) => {
                const statusColor = getStatusColor(scan.temperature, scan.heart_rate, scan.systolic, scan.diastolic);
                const statusText = getStatusText(scan.temperature, scan.heart_rate, scan.systolic, scan.diastolic);
                
                return (
                  <View
                    key={scan.vitals_id}
                    style={[styles.scanCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                  >
                    <View style={styles.scanHeader}>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                      </View>
                      <Text style={[styles.scanDate, { color: colors.textMuted }]}>
                        {new Date(scan.timelog).toLocaleDateString(undefined, { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </Text>
                    </View>

                    <View style={styles.vitalsGrid}>
                      <View style={styles.vitalItem}>
                        <Ionicons name="thermometer" size={20} color="#EF4444" />
                        <Text style={[styles.vitalLabel, { color: colors.textSecondary }]}>Temp</Text>
                        <Text style={[styles.vitalValue, { color: colors.textPrimary }]}>{scan.temperature}°C</Text>
                      </View>
                      
                      <View style={styles.vitalItem}>
                        <Ionicons name="heart" size={20} color="#EC407A" />
                        <Text style={[styles.vitalLabel, { color: colors.textSecondary }]}>BP</Text>
                        <Text style={[styles.vitalValue, { color: colors.textPrimary }]}>
                          {scan.systolic}/{scan.diastolic || '--'}
                        </Text>
                      </View>
                      
                      <View style={styles.vitalItem}>
                        <Ionicons name="pulse" size={20} color="#E53935" />
                        <Text style={[styles.vitalLabel, { color: colors.textSecondary }]}>HR</Text>
                        <Text style={[styles.vitalValue, { color: colors.textPrimary }]}>{scan.heart_rate}</Text>
                      </View>
                    </View>

                    <View style={styles.scanFooter}>
                      <Text style={[styles.scanTime, { color: colors.textMuted }]}>
                        {new Date(scan.timelog).toLocaleTimeString(undefined, { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  refreshButton: { padding: 4 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: '600' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  countText: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  scanCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  scanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '700' },
  scanDate: { fontSize: 13, fontWeight: '600' },
  vitalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  vitalItem: { alignItems: 'center' },
  vitalLabel: { fontSize: 11, marginTop: 4, marginBottom: 2 },
  vitalValue: { fontSize: 16, fontWeight: '700' },
  scanFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  scanTime: { fontSize: 13, fontWeight: '600' },
});

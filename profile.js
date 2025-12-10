import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { ActivityLogger } from './activityLogger';

// add Supabase REST config (use same values as other files)
const SUPABASE_URL = 'https://dftmxaoxygilbhbonrnu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YyxtmFa4_omJeaejR6S3gA_D6f1Ycs0';

export default function ProfileScreen({ onNavigate, onBack, user }) {
  const { colors, isDarkMode } = useTheme();
  const [isEditing, setIsEditing] = useState(false);

  // replace static profileData with state that will be filled from Supabase
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Log profile view activity
  useEffect(() => {
    if (user && user.studentId) {
      ActivityLogger.viewProfile(user.studentId);
    }
  }, [user]);

  // fetch student row when user prop is available
  useEffect(() => {
    if (!user || !user.studentId) {
      setProfileData(null);
      return;
    }
    const fetchProfile = async () => {
      setLoading(true);
      try {
        // Fetch student with program and year_level joins
        const url = `${SUPABASE_URL}/rest/v1/students?select=student_id,first_name,last_name,email,last_update,contact_number,program:program_id(program,college:college_id(college)),year_level:year_level_id(year_level)&student_id=eq.${user.studentId}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok) {
          console.warn('Failed to fetch student', await res.text());
          setProfileData(null);
          setLoading(false);
          return;
        }
        const rows = await res.json();
        const row = Array.isArray(rows) && rows.length ? rows[0] : null;
        if (row) {
          // normalize field names to match UI keys
          setProfileData({
            studentId: row.student_id?.toString() ?? '',
            name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
            email: row.email ?? '',
            program: row.program?.program ?? '',
            college: row.program?.college?.college ?? '',
            yearLevel: row.year_level?.year_level ? row.year_level.year_level.replace(/_/g, ' ') : '',
            contactNumber: row.contact_number?.toString() ?? '',
            lastUpdate: row.last_update ?? null,
          });
        } else {
          setProfileData(null);
        }
      } catch (err) {
        console.warn('Error fetching profile', err);
        setProfileData(null);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleBack = () => {
    if (typeof onBack === 'function') onBack();
    else if (typeof onNavigate === 'function') onNavigate('Home');
    else Alert.alert('Back', 'Back action not implemented');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={isDarkMode ? ['#0B1120', '#1E293B', '#0B1120'] : ['#EEF2FF', '#F5E8FF', '#FFF1F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleBack} style={styles.iconButton} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: colors.primary }]}>Profile</Text>

          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Loading / fallback */}
          {loading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <>
              {/* Profile Header */}
              <View style={[styles.profileCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <LinearGradient colors={['#7C3AED', '#EC4899']} style={styles.avatar}>
                  <Text style={styles.avatarInitials}>
                    {/* initials from fetched name or placeholder */}
                    {profileData && profileData.name
                      ? profileData.name.split(' ').map((n) => n[0]).slice(0, 2).join('')
                      : '--'}
                  </Text>
                </LinearGradient>
                <Text style={[styles.name, { color: colors.textPrimary }]}>{profileData?.name ?? 'Student Name'}</Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>{profileData?.studentId ?? 'Student ID'}</Text>
                {profileData?.yearLevel && (
                  <Text style={[styles.year, { color: colors.primary }]}>{profileData.yearLevel}</Text>
                )}
              </View>

              {/* Personal Information */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <LinearGradient colors={['#7C3AED', '#EC4899']} style={styles.sectionIcon}>
                    <Ionicons name="person" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Personal Information</Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                >
                  <LinearGradient colors={['#7C3AED', '#EC4899']} style={styles.infoBadge}>
                    <Text style={styles.infoBadgeText}>S</Text>
                  </LinearGradient>
                  <View style={styles.infoBody}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Student ID</Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{profileData?.studentId ?? '-'}</Text>
                  </View>
                </View>

                <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                >
                  <LinearGradient colors={['#EC4899', '#F97316']} style={styles.infoBadge}>
                    <Text style={styles.infoBadgeText}>N</Text>
                  </LinearGradient>
                  <View style={styles.infoBody}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Name</Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{profileData?.name ?? '-'}</Text>
                  </View>
                </View>

                <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                >
                  <LinearGradient colors={['#6366F1', '#06B6D4']} style={styles.infoBadge}>
                    <Text style={styles.infoBadgeText}>E</Text>
                  </LinearGradient>
                  <View style={styles.infoBody}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Email</Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{profileData?.email ?? '-'}</Text>
                  </View>
                </View>

                {profileData?.contactNumber && (
                  <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                  >
                    <LinearGradient colors={['#10B981', '#06B6D4']} style={styles.infoBadge}>
                      <Text style={styles.infoBadgeText}>C</Text>
                    </LinearGradient>
                    <View style={styles.infoBody}>
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Contact Number</Text>
                      <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{profileData.contactNumber}</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Academic Information */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <LinearGradient colors={['#EC4899', '#F97316']} style={styles.sectionIcon}>
                    <Ionicons name="book" size={16} color="#fff" />
                  </LinearGradient>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Academic Information</Text>
                </View>

                <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                >
                  <LinearGradient colors={['#7C3AED', '#EC4899']} style={styles.infoBadge}>
                    <Text style={styles.infoBadgeText}>P</Text>
                  </LinearGradient>
                  <View style={styles.infoBody}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Program</Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{profileData?.program || '-'}</Text>
                  </View>
                </View>

                {profileData?.college && (
                  <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                  >
                    <LinearGradient colors={['#6366F1', '#7C3AED']} style={styles.infoBadge}>
                      <Text style={styles.infoBadgeText}>C</Text>
                    </LinearGradient>
                    <View style={styles.infoBody}>
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>College</Text>
                      <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{profileData.college}</Text>
                    </View>
                  </View>
                )}

                <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
                >
                  <LinearGradient colors={['#EC4899', '#F97316']} style={styles.infoBadge}>
                    <Text style={styles.infoBadgeText}>Y</Text>
                  </LinearGradient>
                  <View style={styles.infoBody}>
                    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Year Level</Text>
                    <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{profileData?.yearLevel || '-'}</Text>
                  </View>
                </View>
              </View>


              <View style={styles.notice}>
                <Text style={[styles.noticeTitle, { color: colors.textMuted }]}>Last updated</Text>
                <Text style={[styles.noticeSub, { color: colors.textMuted }]}>
                  {profileData?.lastUpdate ? new Date(profileData.lastUpdate).toLocaleString() : 'Unknown'}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  background: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderBottomWidth: 1,
    borderBottomColor: '#E6E9EE',
  },
  iconButton: { padding: 6, borderRadius: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#6D28D9' },

  container: { padding: 16, paddingBottom: 40 },

  profileCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3E8FF',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.06,
    elevation: 3,
  },
  avatar: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarInitials: { color: '#fff', fontWeight: '800', fontSize: 28 },
  name: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  year: { fontSize: 13, color: '#7C3AED', marginTop: 4, fontWeight: '700' },

  section: { marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionIcon: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3E8FF',
  },
  infoBadge: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  infoBadgeText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  infoBody: { marginLeft: 12, flex: 1 },
  infoLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  infoValue: { fontSize: 15, color: '#0F172A', fontWeight: '800' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3E8FF',
  },
  gridBadge: { width: 44, height: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  gridBadgeText: { color: '#fff', fontWeight: '800' },
  gridLabel: { fontSize: 12, color: '#6B7280', marginBottom: 6, fontWeight: '600' },
  gridValue: { fontSize: 16, color: '#0F172A', fontWeight: '800' },

  settingsButton: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E6E9EE',
    marginTop: 8,
  },
  settingsText: { marginLeft: 8, fontWeight: '800', color: '#374151' },

  notice: { alignItems: 'center', marginTop: 14, opacity: 0.6 },
  noticeTitle: { color: '#9CA3AF', fontWeight: '600' },
  noticeSub: { color: '#9CA3AF', fontSize: 12 },
});

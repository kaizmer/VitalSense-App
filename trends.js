import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Circle, Rect } from 'react-native-svg';
import { useTheme } from './ThemeContext';

const { width } = Dimensions.get('window');

// Supabase REST config (use your project's values / env)
const SUPABASE_URL = 'https://dftmxaoxygilbhbonrnu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YyxtmFa4_omJeaejR6S3gA_D6f1Ycs0';

// helper: convert Catmull-Rom to Bezier path for smooth curves
function catmullRom2bezier(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i === 0 ? points[0] : points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i + 2 < points.length ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// helper: group records by day/week/month and average values
function aggregate(records, key, timeframe) {
  if (!records || records.length === 0) return { labels: [], values: [] };

  const now = new Date();
  if (timeframe === 'daily') {
    const days = 14;
    const buckets = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const keyStr = `${yyyy}-${mm}-${dd}`;
      buckets.push({ key: keyStr, date: d, sum: 0, count: 0 });
    }
    const map = Object.fromEntries(buckets.map(b => [b.key, b]));
    records.forEach(r => {
      const d = new Date(r.record_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if (map[k]) {
        const v = extractMetricValue(r, key);
        if (!Number.isNaN(v)) { map[k].sum += v; map[k].count += 1; }
      }
    });
    const labels = buckets.map(b => b.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
    const values = buckets.map(b => (b.count ? +(b.sum / b.count).toFixed(2) : 0));
    return { labels, values };
  } else if (timeframe === 'weekly') {
    const weeks = 12;
    // compute start of week (Mon)
    function weekStart(date) {
      const d = new Date(date);
      const day = (d.getDay() + 6) % 7; // 0 = Monday
      d.setDate(d.getDate() - day);
      d.setHours(0,0,0,0);
      return d;
    }
    const buckets = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const ref = new Date(now);
      ref.setDate(now.getDate() - i * 7);
      const ws = weekStart(ref);
      const keyStr = `${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}`;
      buckets.push({ key: keyStr, date: ws, sum: 0, count: 0 });
    }
    const map = Object.fromEntries(buckets.map(b => [b.key, b]));
    records.forEach(r => {
      const d = new Date(r.record_at);
      const ws = weekStart(d);
      const k = `${ws.getFullYear()}-${String(ws.getMonth()+1).padStart(2,'0')}-${String(ws.getDate()).padStart(2,'0')}`;
      if (map[k]) {
        const v = extractMetricValue(r, key);
        if (!Number.isNaN(v)) { map[k].sum += v; map[k].count += 1; }
      }
    });
    const labels = buckets.map(b => {
      const start = b.date;
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;
    });
    const values = buckets.map(b => (b.count ? +(b.sum / b.count).toFixed(2) : 0));
    return { labels, values };
  } else { // monthly
    const months = 6;
    const buckets = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const keyStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      buckets.push({ key: keyStr, date: d, sum: 0, count: 0 });
    }
    const map = Object.fromEntries(buckets.map(b => [b.key, b]));
    records.forEach(r => {
      const d = new Date(r.record_at);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (map[k]) {
        const v = extractMetricValue(r, key);
        if (!Number.isNaN(v)) { map[k].sum += v; map[k].count += 1; }
      }
    });
    const labels = buckets.map(b => b.date.toLocaleDateString(undefined,{ month:'short' }));
    const values = buckets.map(b => (b.count ? +(b.sum / b.count).toFixed(2) : 0));
    return { labels, values };
  }
}

function extractMetricValue(r, key) {
  if (key === 'Temperature') return typeof r.temperature === 'number' ? r.temperature : parseFloat(r.temperature) || NaN;
  if (key === 'Heart Rate') return typeof r.heart_rate === 'number' ? r.heart_rate : parseFloat(r.heart_rate) || NaN;
  // Blood Pressure: use systolic from new schema
  if (typeof r.systolic === 'number') return r.systolic;
  const sys = parseFloat(r.systolic);
  return Number.isFinite(sys) ? sys : NaN;
}

export default function Trends({ metric = 'Blood Pressure', onBack, user }) {
  const { colors, isDarkMode } = useTheme();
  
  const [selectedMetric, setSelectedMetric] = useState(metric !== 'all' ? metric : null);
  const effectiveMetric = selectedMetric ?? (metric === 'all' ? null : metric);
  const inListMode = metric === 'all' && !selectedMetric;

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState('monthly'); // 'daily' | 'weekly' | 'monthly'

  useEffect(() => {
    if (!user) { setRecords([]); return; }
    const fetchRecords = async () => {
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
        if (!consentRes.ok) { console.warn('Consent fetch failed', await consentRes.text()); setRecords([]); setLoading(false); return; }
        const consents = await consentRes.json();
        if (!Array.isArray(consents) || consents.length === 0) { setRecords([]); setLoading(false); return; }
        
        const consentIds = consents.map(c => c.consent_id).join(',');
        
        // Fetch vitals using consent_id(s)
        const url = `${SUPABASE_URL}/rest/v1/vitals?select=vitals_id,consent_id,timelog,temperature,heart_rate,systolic,diastolic&consent_id=in.(${consentIds})&order=timelog.asc&limit=500`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok) { console.warn('Trends fetch failed', await res.text()); setRecords([]); setLoading(false); return; }
        const rows = await res.json();
        // Keep raw data with systolic/diastolic separate for BP stats
        const transformed = (Array.isArray(rows) ? rows : []).map(r => ({
          record_at: r.timelog,
          temperature: r.temperature,
          heart_rate: r.heart_rate,
          systolic: r.systolic,
          diastolic: r.diastolic,
          blood_pressure: r.diastolic ? `${r.systolic}/${r.diastolic}` : `${r.systolic}`,
        }));
        setRecords(transformed);
      } catch (err) {
        console.warn('Error fetching trends', err);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, [user, metric, selectedMetric]);

  // compute aggregated data for current timeframe & metric
  const { values, labels, unit, gradient } = useMemo(() => {
    const key = effectiveMetric ?? 'Blood Pressure';
    const agg = aggregate(records, key, timeframe);
    
    // Check if we have real data (not just empty buckets)
    const hasRealData = agg && agg.values && agg.values.length > 0 && agg.values.some(v => v > 0);
    
    if (hasRealData) {
      // Use real data from database
      if (key === 'Temperature') {
        return { values: agg.values, labels: agg.labels, unit: '°C', gradient: ['#EF4444', '#F97316'] };
      }
      if (key === 'Heart Rate') {
        return { values: agg.values, labels: agg.labels, unit: 'bpm', gradient: ['#EF4444', '#DC2626'] };
      }
      // Blood Pressure
      return { values: agg.values, labels: agg.labels, unit: 'mmHg', gradient: ['#9333ea', '#ec4899'] };
    }
    
    // No real data - show empty state instead of fallback samples
    // Return empty arrays so the "No data yet" message shows
    if (key === 'Temperature') {
      return { values: [], labels: [], unit: '°C', gradient: ['#EF4444', '#F97316'] };
    }
    if (key === 'Heart Rate') {
      return { values: [], labels: [], unit: 'bpm', gradient: ['#EF4444', '#DC2626'] };
    }
    return { values: [], labels: [], unit: 'mmHg', gradient: ['#9333ea', '#ec4899'] };
  }, [records, effectiveMetric, timeframe]);

  // Compute BP-specific stats (systolic/diastolic min/max)
  const bpStats = useMemo(() => {
    if (effectiveMetric !== 'Blood Pressure' || records.length === 0) return null;
    
    const systolicValues = records.map(r => r.systolic).filter(v => Number.isFinite(v));
    const diastolicValues = records.map(r => r.diastolic).filter(v => Number.isFinite(v));
    
    if (systolicValues.length === 0) return null;
    
    return {
      systolicMax: Math.max(...systolicValues),
      systolicMin: Math.min(...systolicValues),
      diastolicMax: diastolicValues.length > 0 ? Math.max(...diastolicValues) : null,
      diastolicMin: diastolicValues.length > 0 ? Math.min(...diastolicValues) : null,
    };
  }, [records, effectiveMetric]);

  // chart mapping
  const chartWidth = Math.min(340, width - 80);
  const chartHeight = 180;
  const n = values.length || 1;
  const xStep = n > 1 ? chartWidth / (n - 1) : chartWidth;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const mapY = (v) => chartHeight - ((v - minV) / range) * (chartHeight - 8);
  const points = values.map((v, i) => ({ x: i * xStep, y: mapY(v), v }));

  const pathD = catmullRom2bezier(points);

  const avg = values.length ? Math.round((values.reduce((s,a)=>s+a,0)/values.length)*100)/100 : 0;
  const yMaxLabel = Math.round(maxV*10)/10;
  const yMidLabel = Math.round(((maxV+minV)/2)*10)/10;
  const yMinLabel = Math.round(minV*10)/10;

  const handleBackPress = () => {
    if (metric === 'all' && selectedMetric) { setSelectedMetric(null); return; }
    if (typeof onBack === 'function') onBack();
  };

  // UI: render list mode or chart mode; include timeframe tabs (daily/weekly/monthly)
  if (inListMode) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LinearGradient colors={isDarkMode ? ['#1F2937', '#111827', '#0F172A'] : ['#E8EAF6','#F3E5F5','#FCE4EC']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.gradient}>
          <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={handleBackPress} style={styles.backButton} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.primary }]}>Trends</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={{ marginBottom: 12, fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>Select a trend</Text>
            {/*
              TODO: Localize these trend titles & units
            */}
            {/*
              key: metric key, used for internal state & charting
              subtitle: unit label, shown under the title
              gradient: colors for the trend indicator (top part of the card)
              icon: ionicon name for the leading icon
            */}
            {/*
              NOTE: If you add/remove metrics here, also update the list in `HealthHome.js`
            */}
            {[
              { key: 'Blood Pressure', subtitle: 'mmHg', gradient: ['#9333ea','#ec4899'], icon:'heart' },
              { key: 'Temperature', subtitle: '°C', gradient: ['#EF4444','#F97316'], icon:'thermometer' },
              { key: 'Heart Rate', subtitle: 'bpm', gradient: ['#EF4444','#DC2626'], icon:'pulse' },
            ].map(t => (
              <TouchableOpacity key={t.key} style={[styles.trendCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]} activeOpacity={0.85} onPress={() => setSelectedMetric(t.key)}>
                <LinearGradient colors={t.gradient} style={styles.trendCardBadge}><Ionicons name={t.icon} size={22} color="#fff" /></LinearGradient>
                <View style={{flex:1, marginLeft:12}}>
                  <Text style={{fontSize:16,fontWeight:'800',color:colors.textPrimary}}>{t.key}</Text>
                  <Text style={{color:colors.textSecondary,marginTop:4}}>{t.subtitle} • Recent</Text>
                </View>
                <Text style={{fontWeight:'800',color:colors.primary}}>View</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </LinearGradient>
      </View>
    );
  }

  // Chart UI
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={isDarkMode ? ['#1F2937', '#111827', '#0F172A'] : ['#E8EAF6','#F3E5F5','#FCE4EC']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.gradient}>
        <View style={[styles.header, { backgroundColor: colors.cardBackground, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton} activeOpacity={0.7}><Ionicons name="arrow-back" size={24} color={colors.textPrimary} /></TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>{(selectedMetric ?? metric)} Trend</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {records.length === 0 || values.length === 0 ? (
            <View style={styles.noDataContainer}>
              <Ionicons name="bar-chart-outline" size={64} color={colors.textMuted} />
              <Text style={[styles.noDataTitle, { color: colors.primary }]}>No data yet</Text>
              <Text style={[styles.noDataSubtitle, { color: colors.textSecondary }]}>
                {records.length === 0 
                  ? 'Complete your first VitalSense kiosk scan to view your health trends.'
                  : `No ${effectiveMetric ?? 'data'} records available for the selected timeframe.`}
              </Text>
            </View>
          ) : (
            <>
          {/* timeframe tabs */}
          <View style={{flexDirection:'row', justifyContent:'center', marginBottom:16}}>
            {['daily','weekly','monthly'].map(tf => {
              const active = timeframe === tf;
              return (
                <TouchableOpacity key={tf} onPress={() => setTimeframe(tf)} style={{ marginRight:8 }}>
                  <View style={active ? [styles.tabActive, { backgroundColor: colors.primary }] : [styles.tabInactive, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                    <Text style={active ? styles.tabTextActive : [styles.tabTextInactive, { color: colors.textSecondary }]}>{tf.charAt(0).toUpperCase()+tf.slice(1)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.chartCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <View style={styles.chartContainer}>
              <View style={styles.yAxis}>
                <Text style={[styles.yAxisLabel, { color: colors.textSecondary }]}>{yMaxLabel}</Text>
                <Text style={[styles.yAxisLabel, { color: colors.textSecondary }]}>{yMidLabel}</Text>
                <Text style={[styles.yAxisLabel, { color: colors.textSecondary }]}>{yMinLabel}</Text>
              </View>

              <View style={styles.chartArea}>
                {/* grid */}
                <View style={styles.gridContainer}>
                  {[0,1,2].map(i => <View key={i} style={[styles.gridLine, { backgroundColor: colors.border }]} />)}
                </View>

                {/* SVG chart - same as before */}
                <View style={{ width: chartWidth, height: chartHeight, alignSelf:'center' }}>
                  <Svg width={chartWidth} height={chartHeight}>
                    <Defs>
                      <SvgLinearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={gradient[0]} stopOpacity="0.35" />
                        <Stop offset="1" stopColor={gradient[1]} stopOpacity="0.05" />
                      </SvgLinearGradient>
                      <SvgLinearGradient id="g2" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={gradient[0]} stopOpacity="1" />
                        <Stop offset="1" stopColor={gradient[1]} stopOpacity="1" />
                      </SvgLinearGradient>
                    </Defs>

                    {/* area under curve */}
                    {pathD ? (
                      <>
                        <Path d={`${pathD} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`} fill="url(#g1)" />
                        <Path d={pathD} fill="none" stroke="url(#g2)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
                        {/* points */}
                        {points.map((p, i) => (
                          <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke={gradient[0]} strokeWidth={2} />
                        ))}
                      </>
                    ) : null}
                  </Svg>
                </View>

                {/* Value labels */}
                <View style={styles.topLabel}>
                  <Text style={[styles.labelValue, { color: colors.primary }]}>{Math.round(maxV*100)/100}{unit ? ` ${unit}` : ''}</Text>
                  <Text style={[styles.labelSubValue, { color: colors.textMuted }]}>{yMidLabel}</Text>
                </View>
                <View style={styles.bottomLabel}>
                  <Text style={[styles.labelValue, { color: colors.primary }]}>{Math.round(minV*100)/100}{unit ? ` ${unit}` : ''}</Text>
                  <Text style={[styles.labelSubValue, { color: colors.textMuted }]}>{yMinLabel}</Text>
                </View>
              </View>
            </View>

            {/* x axis labels */}
            <View style={[styles.xAxis, { width: chartWidth }]}>
              {labels.map((lab, i) => (
                <Text key={i} style={[styles.xAxisLabel, { color: colors.textSecondary }]}>{lab}</Text>
              ))}
            </View>

            {/* average card - same gradient */}
            <TouchableOpacity activeOpacity={0.9}>
              <LinearGradient colors={gradient} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.averageCard}>
                <Text style={styles.averageLabel}>Average:</Text>
                <Text style={styles.averageValue}>{avg} {unit}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* stats */}
          {bpStats ? (
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Highest Systolic</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>{bpStats.systolicMax}</Text>
                <Text style={[styles.statDate, { color: colors.textMuted }]}>mmHg</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Lowest Systolic</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>{bpStats.systolicMin}</Text>
                <Text style={[styles.statDate, { color: colors.textMuted }]}>mmHg</Text>
              </View>
            </View>
          ) : (
            <View style={styles.statsContainer}>
              <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Highest</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>{Math.round(maxV*100)/100}</Text>
                <Text style={[styles.statDate, { color: colors.textMuted }]}>Latest</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Lowest</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>{Math.round(minV*100)/100}</Text>
                <Text style={[styles.statDate, { color: colors.textMuted }]}>Earliest</Text>
              </View>
            </View>
          )}

          {/* Additional diastolic stats if available */}
          {bpStats && bpStats.diastolicMax !== null && (
            <View style={[styles.statsContainer, { marginTop: 12 }]}>
              <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Highest Diastolic</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>{bpStats.diastolicMax}</Text>
                <Text style={[styles.statDate, { color: colors.textMuted }]}>mmHg</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Lowest Diastolic</Text>
                <Text style={[styles.statValue, { color: colors.primary }]}>{bpStats.diastolicMin}</Text>
                <Text style={[styles.statDate, { color: colors.textMuted }]}>mmHg</Text>
              </View>
            </View>
          )}
            </>
          )}
        </ScrollView>
      </LinearGradient>
    </View>
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
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: { padding: 8, borderRadius: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#5E35B1' },
  headerSpacer: { width: 40 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },

  tabActive: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#5E35B1',
    borderRadius: 14,
  },
  tabInactive: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  tabTextInactive: { color: '#757575', fontWeight: '600' },

  chartCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#5E35B1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  chartContainer: { flexDirection: 'row', marginBottom: 12 },
  yAxis: { justifyContent: 'space-between', paddingVertical: 8, marginRight: 12 },
  yAxisLabel: { fontSize: 11, fontWeight: '700', color: '#757575' },

  chartArea: { flex: 1, position: 'relative', minHeight: 180 },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  gridLine: { height: 1, backgroundColor: '#E0E0E0' },

  topLabel: { position: 'absolute', top: 0, right: 0 },
  bottomLabel: { position: 'absolute', bottom: 0, left: 0 },
  labelValue: { fontSize: 11, fontWeight: '700', color: '#5E35B1' },
  labelSubValue: { fontSize: 9, fontWeight: '600', color: '#9E9E9E' },

  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  xAxisLabel: { fontSize: 11, fontWeight: '700', color: '#757575', minWidth: 40, textAlign: 'center' },

  averageCard: { borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, alignSelf: 'stretch' },
  averageLabel: { fontSize: 14, fontWeight: '700', color: '#fff' },
  averageValue: { fontSize: 18, fontWeight: '700', color: '#fff' },

  statsContainer: { flexDirection: 'row', marginTop: 12, gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#5E35B1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  statLabel: { fontSize: 13, fontWeight: '600', color: '#757575', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#5E35B1', marginBottom: 4 },
  statDate: { fontSize: 11, color: '#9E9E9E' },

  // list-card styles
  trendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3E8FF',
    shadowColor: '#5E35B1',
    shadowOpacity: 0.04,
    elevation: 2,
  },
  trendCardBadge: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noDataTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#5E35B1',
    marginTop: 16,
    marginBottom: 8,
  },
  noDataSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#9E9E9E',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});

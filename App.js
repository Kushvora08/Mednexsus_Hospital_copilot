import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { createClinicalEngine, SAMPLE_REPORT_TEXT, SAMPLE_REPORTS, SAMPLE_APPOINTMENTS, SAMPLE_PRESCRIPTION, SOURCES, LABS } from './src/clinical';
import { DATA_KEY, SESSION_KEY, storage } from './src/storage';
import { Alerts, Button, Card, Copy, Field, styles as s } from './src/ui';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import PatientHome, { Brand, PatientHeader, BottomNav } from './src/PatientHome';

const clone = value => JSON.parse(JSON.stringify(value));
const seedEngine = createClinicalEngine({});
const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const patientTabs = ['Dashboard', 'Reports', 'Knowledge', 'Medicines', 'Consultations', 'Timeline', 'Safety', 'Profile'];
const doctorTabs = ['Overview', 'Patient Queue', 'Consultation Brief', 'Safety Review', 'Appointments', 'SOAP Notes'];

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ CormorantGaramond_600SemiBold: require('@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf'), ...Ionicons.font });
  return <SafeAreaProvider>{fontsLoaded || fontError ? <Application /> : <SafeAreaView style={[s.root, { justifyContent: 'center' }]}><ActivityIndicator accessibilityLabel="Loading app" color="#42634e" /></SafeAreaView>}</SafeAreaProvider>;
}

function Application() {
  const { width } = useWindowDimensions();
  const [data, setData] = useState(null);
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState('Dashboard');
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const [loadingError, setLoadingError] = useState('');
  const [busy, setBusy] = useState(false);
  const scroll = useRef(null);
  const [selectedReportId, setSelectedReportId] = useState(null);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [tab, selected]);

  async function load() {
    try {
      setLoadingError('');
      const [raw, userId] = await Promise.all([storage.getItem(DATA_KEY), storage.getItem(SESSION_KEY)]);
      const saved = raw ? JSON.parse(raw) : { users: [seedEngine.createDemoUser(), seedEngine.createDemoDoctor()] };
      if (!Array.isArray(saved.users)) throw new Error('The saved account data is invalid.');
      saved.users = saved.users.map(user => ({ ...user, patient: { ...user.patient, conditions: user.patient?.conditions || [], allergies: user.patient?.allergies || [], medicines: user.patient?.medicines || [] }, reports: user.reports || [], appointments: user.appointments || [], notes: user.notes || [] }));
      await storage.setItem(DATA_KEY, JSON.stringify(saved));
      const active = saved.users.find(user => user.id === userId);
      setData(saved); setSession(active?.id || null);
      setTab(active?.patient.role === 'Doctor' ? 'Overview' : 'Dashboard');
    } catch (error) { setLoadingError(`Could not load local data: ${error.message}`); }
  }
  useEffect(() => { load(); }, []);

  async function commit(next) {
    await storage.setItem(DATA_KEY, JSON.stringify(next));
    setData(next);
  }
  async function action(fn) {
    if (busy) return;
    setBusy(true); setNotice('');
    try { await fn(); } catch (error) { setNotice(error.message); } finally { setBusy(false); }
  }
  const current = data?.users.find(user => user.id === session);
  const doctor = current?.patient.role === 'Doctor';
  const patients = data?.users.filter(user => user.patient.role !== 'Doctor') || [];
  const subject = doctor ? patients.find(user => user.id === selected) || patients[0] : current;
  const engine = subject ? createClinicalEngine(subject) : null;
  async function updateSubject(patch) {
    if (!subject) throw new Error('Select a patient first.');
    await commit({ ...data, users: data.users.map(user => user.id === subject.id ? { ...user, ...patch } : user) });
  }
  async function signIn(user) {
    await storage.setItem(SESSION_KEY, user.id);
    setSession(user.id); setTab(user.patient.role === 'Doctor' ? 'Overview' : 'Dashboard'); setNotice('');
  }
  if (!data) return <SafeAreaView style={s.root}><View style={s.auth}>{loadingError ? <><Copy>{loadingError}</Copy><Button onPress={load}>Retry</Button></> : <ActivityIndicator accessibilityLabel="Loading saved accounts" color="#42634e" />}</View></SafeAreaView>;
  if (!current) return <SafeAreaView style={s.root}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled"><Auth data={data} commit={commit} signIn={signIn} action={action} busy={busy} notice={notice} /></ScrollView></KeyboardAvoidingView></SafeAreaView>;

  const tabs = doctor ? doctorTabs : patientTabs;
  const nav = tabs.map(name => <Button key={name} secondary selected={tab === name} onPress={() => { setTab(name); setNotice(''); }}>{name}</Button>);
  return <SafeAreaView style={s.root}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[s.shell, width >= 900 && s.wide]}>
    {width >= 900 && <ScrollView style={s.sidebar}><Brand demo={current.id.startsWith('demo-')} /><Text style={[s.eyebrow, { marginVertical: 16 }]}>{doctor ? 'Doctor Copilot' : 'Patient workspace'}</Text><View style={{ gap: 8 }}>{nav}</View></ScrollView>}
    <View style={{ flex: 1 }}>
      {width < 900 && doctor && <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={s.tabBar} showsHorizontalScrollIndicator={false}>{nav}</ScrollView>}
      {!doctor && <PatientHeader patient={current.patient} demo={current.id.startsWith('demo-')} onProfile={() => setTab('Profile')} />}
      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, !doctor && { maxWidth: 860, paddingTop: tab === 'Dashboard' ? 0 : 18, paddingHorizontal: 20, paddingBottom: 20 }]}>
        {(doctor || tab !== 'Dashboard' || width >= 900) && <View style={s.row}><View style={{ flex: 1 }}><Text style={s.eyebrow}>{doctor ? 'Doctor workspace' : 'Your health, together'}</Text><Text style={s.heading}>{tab === 'Dashboard' ? 'Home' : tab === 'Knowledge' ? 'Health information' : tab === 'Consultations' ? 'Appointments' : tab === 'Safety' ? 'Safety checks' : tab}</Text>{doctor && <Copy muted>{current.patient.name}</Copy>}</View><Button secondary disabled={busy} onPress={() => action(async () => { await storage.removeItem(SESSION_KEY); setSession(null); setSelected(null); })}>Log out</Button></View>}
        {!!notice && <View accessibilityLiveRegion="polite" style={s.alert}><Copy>{notice}</Copy></View>}
        {busy && <ActivityIndicator color="#42634e" />}
        {doctor && <Card title="Selected patient"><View style={s.row}>{patients.map(user => <Button key={user.id} secondary selected={subject?.id === user.id} onPress={() => setSelected(user.id)}>{user.patient.name}</Button>)}</View>{!patients.length && <Copy>No patient accounts yet.</Copy>}</Card>}
        {subject && <Workspace key={subject.id} {...{ tab, doctor, subject, engine, data, updateSubject, action, busy, setNotice, setTab, selectedReportId, setSelectedReportId }} />}
        {tab !== 'Dashboard' && <Copy muted>Educational demo · Local data · Outputs require clinician review. Not for diagnosis, treatment, or emergency triage.</Copy>}
      </ScrollView>
      {!doctor && width < 900 && <BottomNav tab={tab} onNavigate={name => { setTab(name); setNotice(''); }} />}
    </View>
  </View></KeyboardAvoidingView></SafeAreaView>;
}

function Auth({ data, commit, signIn, action, busy, notice }) {
  const [role, setRole] = useState('Patient');
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', age: '', conditions: '', medicines: '', allergies: '', specialty: '', hospital: '' });
  const [sample, setSample] = useState(false);
  const field = (key, label, extra = {}) => <Field key={key} label={label} value={form[key]} onChangeText={value => setForm({ ...form, [key]: value })} {...extra} />;
  async function submit() {
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !form.password) throw new Error('Enter a valid email and password.');
    if (!register) {
      const user = data.users.find(item => item.email.toLowerCase() === email && item.password === form.password && item.patient.role === role);
      if (!user) throw new Error('Email, password, or selected role does not match.');
      await signIn(user); return;
    }
    if (!form.name.trim() || form.password.length < 6) throw new Error('Enter your name and a password with at least six characters.');
    if (data.users.some(user => user.email.toLowerCase() === email)) throw new Error('An account with that email already exists.');
    if (role === 'Patient' && (!Number.isInteger(Number(form.age)) || Number(form.age) < 1 || Number(form.age) > 120)) throw new Error('Enter an age between 1 and 120.');
    const list = value => value.split(',').map(item => item.trim()).filter(Boolean);
    const user = { id: uid('user'), email, password: form.password, createdAt: new Date().toISOString(), patient: { name: form.name.trim(), email, role, age: Number(form.age), conditions: list(form.conditions), medicines: list(form.medicines), allergies: list(form.allergies), specialty: form.specialty, hospital: form.hospital }, reports: sample && role === 'Patient' ? clone(SAMPLE_REPORTS) : [], appointments: [], notes: [] };
    await commit({ ...data, users: [...data.users, user] }); await signIn(user);
  }
  return <View style={s.auth}><View><Text style={s.brand}>MedNexsus</Text><Text style={[s.heading, { marginTop: 24 }]}>Your care, connected.</Text><Copy>Reports, medicines, and consultation preparation in one workspace.</Copy></View><Card title={`${register ? 'Create' : 'Access'} your account`}><View style={s.row}>{['Patient', 'Doctor'].map(item => <Button secondary selected={role === item} key={item} onPress={() => setRole(item)}>{item}</Button>)}</View>
    {register && field('name', 'Full name')}{field('email', 'Email', { keyboardType: 'email-address', autoCapitalize: 'none' })}{field('password', 'Password', { secureTextEntry: true, autoCapitalize: 'none' })}
    {register && (role === 'Patient' ? <>{field('age', 'Age', { keyboardType: 'number-pad' })}{field('conditions', 'Conditions (comma separated)')}{field('medicines', 'Medicines (comma separated)')}{field('allergies', 'Allergies (comma separated)')}<Button secondary selected={sample} onPress={() => setSample(!sample)}>{sample ? 'Sample reports enabled' : 'Add sample reports'}</Button></> : <>{field('specialty', 'Specialty')}{field('hospital', 'Hospital')}</>)}
    {!!notice && <View accessibilityLiveRegion="polite"><Copy>{notice}</Copy></View>}
    <Button disabled={busy} onPress={() => action(submit)}>{register ? 'Create account' : 'Sign in'}</Button><Button secondary onPress={() => setRegister(!register)}>{register ? 'Already registered? Sign in' : 'Create a new account'}</Button>
    <Button secondary disabled={busy} onPress={() => action(() => signIn(data.users.find(user => user.id === (role === 'Patient' ? 'demo-patient' : 'demo-doctor')) || (() => { throw new Error('Demo account is unavailable.'); })()))}>Explore {role.toLowerCase()} demo</Button>
  </Card><Copy muted>Demo accounts are stored locally with plain-text passwords. Use sample information only.</Copy></View>;
}

function Workspace({ tab, doctor, subject, engine, data, updateSubject, action, busy, setNotice, setTab, selectedReportId, setSelectedReportId }) {
  const { patient, reports, appointments = [], notes = [] } = subject;
  const latest = engine.getLatestReport();
  const abnormal = engine.getAbnormalLabs(latest);
  const missing = engine.getMissingInformation(latest.values);
  const safety = text => engine.runSafetyEngine({ text, labs: latest.values, medicines: patient.medicines, allergies: patient.allergies });
  const [reportText, setReportText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [question, setQuestion] = useState('Why is high creatinine important in diabetes?');
  const [answers, setAnswers] = useState([]);
  const [prescription, setPrescription] = useState(patient.medicines.join('\n'));
  const [allergies, setAllergies] = useState(patient.allergies.join(', '));
  const [medResult, setMedResult] = useState(null);
  const [safetyText, setSafetyText] = useState('');
  const [alerts, setAlerts] = useState(null);
  const [focus, setFocus] = useState('Review abnormal values, medicines, and follow-up tests.');
  const [brief, setBrief] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [soap, setSoap] = useState(null);
  const [booking, setBooking] = useState({ specialist: 'General Physician', type: 'Video Call', date: '', reason: '' });
  const [profile, setProfile] = useState({ ...patient, age: String(patient.age || ''), conditions: patient.conditions.join(', '), medicines: patient.medicines.join(', '), allergies: patient.allergies.join(', ') });
  const [metric, setMetric] = useState('hba1c');
  const [organ, setOrgan] = useState('Kidney');
  const [timelineId, setTimelineId] = useState(null);
  const ordered = [...reports].sort((a, b) => a.date.localeCompare(b.date));

  useEffect(() => {
    setPrescription(patient.medicines.join('\n'));
    setAllergies(patient.allergies.join(', '));
    setMedResult(null);
  }, [patient.medicines, patient.allergies]);

  function labsView(report) {
    return Object.entries(report.values).map(([key, value]) => <View key={key} style={s.line}><Text style={s.label}>{LABS[key]?.label || key} · {engine.formatValue(key, value)} · {engine.classifyLab(key, value).label}</Text><Copy>{LABS[key]?.explanation}</Copy></View>);
  }
  function briefView(result) { return <Card title="Prepared consultation brief"><Copy>{result.focus}</Copy><Copy>Conditions: {patient.conditions.join(', ') || 'Not recorded'}</Copy><Copy>Medicines: {patient.medicines.join(', ') || 'Not recorded'}</Copy><Copy>Allergies: {patient.allergies.join(', ') || 'Not recorded'}</Copy><Copy>{engine.buildPatientStoryText()}</Copy>{abnormal.map(item => <Copy key={item.key}>{item.lab.label}: {engine.formatValue(item.key, item.value)}. {item.lab.explanation}</Copy>)}<Text style={s.label}>Missing information</Text><Copy>{missing.join('; ') || 'No missing items flagged by these demo rules.'}</Copy><Text style={s.label}>Questions for the clinician</Text>{engine.buildDoctorQuestions(latest.values, missing).map(item => <Copy key={item}>{item}</Copy>)}</Card>; }
  async function pickReport() {
    const result = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'text/csv', 'application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!/\.(txt|csv)$/i.test(asset.name)) { setNotice('PDF and image OCR is not available in this demo. Paste extracted text or select a TXT/CSV report.'); return; }
    if (asset.size > 2 * 1024 * 1024) throw new Error('Choose a text file smaller than 2 MB.');
    const text = Platform.OS === 'web' ? await asset.file.text() : await new File(asset.uri).text();
    setReportText(text); setAnalysis(null);
  }

  if (tab === 'Dashboard' && !doctor) return <PatientHome subject={subject} engine={engine} onNavigate={setTab} onReport={id => { setSelectedReportId(id); setTab('Report Details'); }} />;
  if (tab === 'Report Details') {
    const report = reports.find(item => item.id === selectedReportId);
    return <><Button secondary onPress={() => setTab('Dashboard')}>Back to home</Button>{report ? <Card title={report.title}><Copy>{engine.formatDate(report.date)}</Copy><Copy>{report.note}</Copy>{labsView(report)}</Card> : <Copy>This report is no longer available.</Copy>}</>;
  }
  if (tab === 'Care') return <><Card title="How can we help?"><Copy>Choose what you need. Your information stays together.</Copy>{[
    ['Consultations', 'Appointments', 'calendar-outline'], ['Medicines', 'Check medicines', 'medkit-outline'], ['Knowledge', 'Health information', 'book-outline'], ['Timeline', 'Health timeline', 'time-outline'], ['Safety', 'Safety checks', 'shield-checkmark-outline'],
  ].map(([destination, label, icon]) => <Button key={destination} secondary icon={icon} onPress={() => setTab(destination)}>{label}</Button>)}</Card></>;
  if (tab === 'Overview') {
    const score = reports.length ? engine.calculateHealthScore() : null;
    const systems = { Heart: ['ldl', 'hdl'], Lungs: [], Liver: ['alt', 'ast'], Kidney: ['creatinine', 'egfr'], Blood: ['hemoglobin', 'wbc', 'platelets', 'ferritin'] };
    return <><Card dark title={patient.name}><Text style={{ fontSize: 42, fontWeight: '800', color: '#fff' }}>{score ?? '—'}</Text><Text style={{ color: '#d0e9df' }}>{score === null ? 'Add a report to calculate the demo health score' : `Demo health score · ${engine.getRiskLevel(score).label}`}</Text><Text style={{ color: '#d0e9df', lineHeight: 23 }}>{engine.buildPatientStoryText()}</Text></Card>
      <View style={s.row}>{[['Saved reports', reports.length], ['Medicines', patient.medicines.length], ['Flagged values', abnormal.length], ['Appointments', appointments.length]].map(([label, value]) => <View style={s.metric} key={label}><Text style={s.number}>{value}</Text><Copy>{label}</Copy></View>)}</View>
      <Card title="Body system status"><View style={s.row}>{Object.keys(systems).map(name => <Button secondary selected={organ === name} onPress={() => setOrgan(name)} key={name}>{name}</Button>)}</View>{systems[organ].filter(key => latest.values[key] !== undefined).map(key => <Copy key={key}>{LABS[key].label}: {engine.formatValue(key, latest.values[key])} · {engine.classifyLab(key, latest.values[key]).label}</Copy>)}{!systems[organ].some(key => latest.values[key] !== undefined) && <Copy>No relevant markers recorded. This view cannot assess {organ.toLowerCase()} health.</Copy>}</Card>
      <Card title="Clinical reasoning">{abnormal.length ? abnormal.map(item => <View key={item.key} style={s.line}><Text style={s.label}>{item.lab.label} · {item.classification.label}</Text><Copy>{item.lab.explanation}</Copy></View>) : <Copy>No abnormal values detected in the saved report by the demo rules.</Copy>}</Card>
      <Card title="Active safety alerts"><Alerts items={safety(latest.note)} /></Card><Card title="Next actions"><View style={s.row}><Button onPress={() => setTab(doctor ? 'Consultation Brief' : 'Reports')}>{doctor ? 'Prepare brief' : 'Analyze a report'}</Button><Button secondary onPress={() => setTab(doctor ? 'Appointments' : 'Consultations')}>Review consultations</Button></View></Card></>;
  }
  if (tab === 'Reports') return <><Card title="Medical report analyzer"><Copy>Paste a lab report or import a TXT/CSV file. PDF/image OCR is not connected.</Copy><View style={s.row}><Button secondary onPress={() => { setReportText(SAMPLE_REPORT_TEXT.replace('Mira Kapoor', patient.name)); setAnalysis(null); }}>Use sample</Button><Button secondary disabled={busy} onPress={() => action(pickReport)}>Import report</Button></View><Field label="Report text" multiline value={reportText} onChangeText={value => { setReportText(value); setAnalysis(null); }} /><Button onPress={() => { const parsed = engine.parseReport(reportText); if (!Object.keys(parsed.values).length) { setNotice('No lab values found. Include marker names and numeric values.'); return; } setAnalysis(parsed); setNotice(''); }}>Analyze report</Button></Card>
    {analysis && <Card title="Analysis result"><Copy>{analysis.note}</Copy>{labsView(analysis)}<Text style={s.label}>Questions for your doctor</Text>{engine.buildDoctorQuestions(analysis.values, engine.getMissingInformation(analysis.values)).map(item => <Copy key={item}>{item}</Copy>)}<Alerts items={engine.runSafetyEngine({ text: analysis.sourceText, labs: analysis.values, medicines: patient.medicines, allergies: patient.allergies })} /><Button disabled={busy || reports.some(report => report.id === analysis.id)} onPress={() => action(async () => { await updateSubject({ reports: [...reports, analysis] }); setNotice('Report saved to your timeline.'); })}>Save to timeline</Button></Card>}
    <Card title="Report trends"><View style={s.row}>{['hba1c', 'creatinine', 'hemoglobin', 'glucose'].map(key => <Button key={key} secondary selected={metric === key} onPress={() => setMetric(key)}>{LABS[key].label}</Button>)}</View>{ordered.map(report => <View key={report.id} style={s.line}><Copy>{engine.formatDate(report.date)} · {engine.formatValue(metric, report.values[metric])}</Copy>{report.values[metric] !== undefined && <View style={{ height: 8, backgroundColor: '#e8ecdf', borderRadius: 8 }}><View style={{ height: 8, borderRadius: 8, backgroundColor: '#42634e', width: `${Math.max(2, report.values[metric] / Math.max(...reports.map(item => item.values[metric] || 0), 1) * 100)}%` }} /></View>}</View>)}{!reports.length && <Copy>Save reports to compare results over time.</Copy>}</Card></>;

  if (tab === 'Knowledge') return <><Card title="Ask the local knowledge base"><Copy>Answers use the existing curated cards and saved profile. Live retrieval and an LLM are not connected.</Copy><Field label="Medical question" value={question} onChangeText={setQuestion} multiline /><Button onPress={() => { setAnswers(engine.retrieveKnowledge(question)); if (!question.trim()) setNotice('Enter a question first.'); }}>Ask</Button></Card>{answers.map((answer, index) => <Card title={answer.topic} key={`${answer.topic}-${index}`}><Copy>{answer.summary}</Copy>{answer.evidence.map(item => <Copy key={item}>{item}</Copy>)}<Copy>{answer.advice}</Copy>{answer.sourceIds?.map(id => <Text key={id} accessibilityRole="link" style={s.link} onPress={() => action(() => Linking.openURL(SOURCES[id].url))}>{SOURCES[id].label}</Text>)}</Card>)}</>;

  if (tab === 'Medicines') return <><Card title="Prescription check"><Button secondary onPress={() => setPrescription(SAMPLE_PRESCRIPTION)}>Use sample</Button><Field label="Prescription or medicine list" value={prescription} onChangeText={setPrescription} multiline /><Field label="Known allergies" value={allergies} onChangeText={setAllergies} /><Button onPress={() => { if (!prescription.trim()) { setNotice('Enter at least one medicine.'); return; } const medicines = engine.extractMedicines(prescription); setMedResult({ medicines, alerts: [...engine.detectInteractions(medicines.map(med => med.key)), ...engine.runSafetyEngine({ text: prescription, labs: latest.values, medicines: medicines.map(med => med.name), allergies: engine.splitList(allergies) })] }); }}>Analyze medicines</Button></Card>{medResult && <><Card title="Safety checks"><Alerts items={medResult.alerts} /></Card>{medResult.medicines.map(med => <Card key={med.key} title={med.name}><Copy>{med.purpose}</Copy><Copy>Common issues: {med.sideEffects.join(', ')}</Copy><Copy>{med.warnings.join(' ')}</Copy><Text accessibilityRole="link" style={s.link} onPress={() => action(() => Linking.openURL(med.source))}>Medicine source</Text></Card>)}</>}</>;

  if (tab === 'Safety' || tab === 'Safety Review') return <Card title="Rule-based safety review"><Field label="Symptoms, medicines, or notes" value={safetyText} onChangeText={setSafetyText} multiline /><Button onPress={() => setAlerts(safety(safetyText))}>Run safety checks</Button>{alerts && <Alerts items={alerts} />}<Copy muted>Checks combine these notes with saved medicines, allergies, and latest lab values.</Copy></Card>;

  if (tab === 'Consultation Brief') return <><Card title="Consultation preparation"><Field label="Consultation focus" value={focus} onChangeText={setFocus} multiline /><Button onPress={() => setBrief({ focus })}>Generate brief</Button></Card>{brief && briefView(brief)}</>;

  if (tab === 'Consultations') return <><Card title="Book an appointment"><View style={s.row}>{['General Physician', 'Endocrinologist', 'Cardiologist', 'Nephrologist', 'Dermatologist', 'Neurologist'].map(value => <Button key={value} secondary selected={booking.specialist === value} onPress={() => setBooking({ ...booking, specialist: value })}>{value}</Button>)}</View><View style={s.row}>{['Video Call', 'Voice Call', 'In-person Visit'].map(value => <Button key={value} secondary selected={booking.type === value} onPress={() => setBooking({ ...booking, type: value })}>{value}</Button>)}</View><Field label="Local date and time (YYYY-MM-DD HH:mm)" value={booking.date} onChangeText={date => setBooking({ ...booking, date })} /><Field label="Reason for visit" value={booking.reason} onChangeText={reason => setBooking({ ...booking, reason })} multiline /><Button disabled={busy} onPress={() => action(async () => { const input = booking.date.trim(); const date = new Date(input.replace(' ', 'T')); if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(input) || Number.isNaN(date.getTime()) || date <= new Date()) throw new Error('Enter a future appointment date in YYYY-MM-DD HH:mm format.'); if (!booking.reason.trim()) throw new Error('Enter a reason for the visit.'); await updateSubject({ appointments: [...appointments, { id: uid('appointment'), specialist: booking.specialist, type: booking.type, dateTime: date.toISOString(), reason: booking.reason, status: 'Scheduled' }] }); setNotice('Appointment saved locally. A live booking service is not connected.'); })}>Book appointment</Button></Card><Button secondary onPress={() => setBrief({ focus: booking.reason || 'Review latest reports and medicines.' })}>Generate readiness summary</Button>{brief && briefView(brief)}<AppointmentList users={[subject]} /></>;
  if (tab === 'Appointments') return <AppointmentList users={data.users.filter(user => user.patient.role !== 'Doctor')} />;
  if (tab === 'Patient Queue') return <Card title="Patient queue">{data.users.filter(user => user.patient.role !== 'Doctor').map(user => <View key={user.id} style={s.line}><Text style={s.label}>{user.patient.name}</Text><Copy>{user.patient.conditions.join(', ') || 'No conditions recorded'} · {user.reports.length} reports</Copy><Copy>{user.reports.length ? createClinicalEngine(user).getRiskLevel(createClinicalEngine(user).calculateHealthScore()).label : 'No lab data'}</Copy></View>)}</Card>;

  if (tab === 'Timeline') {
    const events = [...reports.map(report => ({ ...report, kind: 'Report' })), ...appointments.map(appointment => ({ ...appointment, date: appointment.dateTime, title: appointment.specialist, note: appointment.reason, kind: 'Appointment' }))].sort((a, b) => new Date(b.date) - new Date(a.date));
    const event = events.find(item => item.id === timelineId) || events[0];
    return <><Card title="Health timeline">{events.map(item => <Button key={item.id} secondary selected={event?.id === item.id} onPress={() => setTimelineId(item.id)}>{engine.formatDate(item.date)} · {item.kind} · {item.title}</Button>)}{!events.length && <Copy>No reports or appointments saved yet.</Copy>}</Card>{event && <Card title={event.title}><Copy>{event.note}</Copy>{event.values && labsView(event)}</Card>}<Card title="Longitudinal narrative"><Copy>{engine.buildPatientStoryText()}</Copy></Card></>;
  }
  if (tab === 'SOAP Notes') return <><Card title="Transcript to SOAP draft"><Field label="Consultation transcript" value={transcript} onChangeText={setTranscript} multiline /><Button onPress={() => { if (!transcript.trim()) { setNotice('Enter a consultation transcript.'); return; } setSoap({ id: uid('note'), date: new Date().toISOString(), subjective: transcript, objective: Object.entries(latest.values).map(([key, value]) => `${LABS[key].label}: ${engine.formatValue(key, value)}`).join('; ') || 'No saved lab data.', assessment: abnormal.length ? `Markers requiring clinician review: ${abnormal.map(item => item.lab.label).join(', ')}. No diagnosis generated.` : 'Insufficient evidence for a clinical assessment.', plan: `Clinician to confirm follow-up and treatment. Missing context: ${missing.join(', ') || 'Full clinical evaluation'}.` }); }}>Generate SOAP draft</Button></Card>{soap && <Card title="Draft · clinician review required">{['subjective', 'objective', 'assessment', 'plan'].map(key => <View key={key}><Text style={s.label}>{key.toUpperCase()}</Text><Copy>{soap[key]}</Copy></View>)}<Button disabled={busy || notes.some(note => note.id === soap.id)} onPress={() => action(async () => { await updateSubject({ notes: [...notes, soap] }); setNotice('SOAP draft saved to this patient account.'); })}>Save draft</Button></Card>}<Card title="Saved drafts">{notes.length ? notes.map(note => <View style={s.line} key={note.id}><Text style={s.label}>{engine.formatDate(note.date)}</Text><Copy>{note.subjective}</Copy><Copy>{note.objective}</Copy><Copy>{note.assessment}</Copy><Copy>{note.plan}</Copy></View>) : <Copy>No saved drafts.</Copy>}</Card></>;

  if (tab === 'Profile') return <Card title="Patient profile">{[['name', 'Patient name'], ['age', 'Age'], ['conditions', 'Conditions (comma separated)'], ['medicines', 'Medicines (comma separated)'], ['allergies', 'Allergies (comma separated)']].map(([key, label]) => <Field key={key} label={label} value={profile[key]} onChangeText={value => setProfile({ ...profile, [key]: value })} keyboardType={key === 'age' ? 'number-pad' : 'default'} />)}<Button disabled={busy} onPress={() => action(async () => { if (!profile.name.trim() || !Number.isInteger(Number(profile.age)) || Number(profile.age) < 1 || Number(profile.age) > 120) throw new Error('Enter a name and an age between 1 and 120.'); await updateSubject({ patient: { ...patient, name: profile.name.trim(), age: Number(profile.age), conditions: engine.splitList(profile.conditions), medicines: engine.splitList(profile.medicines), allergies: engine.splitList(profile.allergies) } }); setNotice('Profile saved.'); })}>Save profile</Button><Button secondary disabled={busy} onPress={() => action(async () => { await updateSubject({ reports: [...reports, ...clone(SAMPLE_REPORTS).filter(sample => !reports.some(report => report.id === sample.id))], appointments: [...appointments, ...clone(SAMPLE_APPOINTMENTS).filter(sample => !appointments.some(appointment => appointment.id === sample.id))] }); setNotice('Sample reports and appointments loaded.'); })}>Load sample reports and appointments</Button></Card>;
  return null;
}

function AppointmentList({ users }) {
  const items = users.flatMap(user => (user.appointments || []).map(item => ({ ...item, patientName: user.patient.name }))).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  return <Card title="Appointment timeline">{items.map(item => <View key={`${item.patientName}-${item.id}`} style={s.line}><Text style={s.label}>{item.specialist} · {item.type}</Text><Copy>{item.patientName} · {new Date(item.dateTime).toLocaleString()}</Copy><Copy>{item.reason}</Copy><Copy muted>{item.status || 'Scheduled'} · Local demo booking</Copy></View>)}{!items.length && <Copy>No appointments scheduled.</Copy>}</Card>;
}



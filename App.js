import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { ThemeProvider, useTheme } from './ThemeContext';
import Login from './login';
import Home from './home';
import HealthNotifications from './notification';
import Trends from './trends';
import ProfileScreen from './profile';
import QRScreen from './qrcode';
import Signup from './signup'; // add import for Signup
import Settings from './settings';
import ScanLogs from './scanlogs';

function AppContent() {
	const [screen, setScreen] = useState('Login'); // wrapper-managed screen
	const [user, setUser] = useState(null);
	const [screenParams, setScreenParams] = useState(null);
	const { colors, isDarkMode } = useTheme();

	const handleLogin = (userPayload) => {
		// store user and navigate to Home
		setUser(userPayload);
		setScreen('Home');
	};

	// general navigation helper that accepts optional params
	const handleNavigate = (name, params = null) => {
		setScreenParams(params);
		setScreen(name);
	};

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			{screen === 'Login' && <Login onLogin={handleLogin} onNavigate={handleNavigate} />}
			{screen === 'Signup' && <Signup onNavigate={handleNavigate} />}
			{screen === 'Home' && <Home onNavigate={handleNavigate} user={user} />}
			{screen === 'Notifications' && (
				<HealthNotifications onNavigate={handleNavigate} user={user} />
			)}
			{screen === 'QR' && (
				<QRScreen
					onNavigate={handleNavigate}
					onBack={() => handleNavigate('Home')}
					user={user}
				/>
			)}
			{screen === 'Trends' && (
				<Trends
					metric={(screenParams && screenParams.metric) || 'Blood Pressure'}
					user={user}
					onBack={() => handleNavigate('Home')}
				/>
			)}
			{screen === 'Profile' && (
				<ProfileScreen
					onNavigate={handleNavigate}
					onBack={() => handleNavigate('Home')}
					user={user}
				/>
			)}
			{screen === 'ScanLogs' && (
				<ScanLogs
					onNavigate={handleNavigate}
					onBack={() => handleNavigate('Home')}
					user={user}
				/>
			)}
			{screen === 'Settings' && <Settings onBack={() => handleNavigate('Home')} />}
			{/* ...future screens can be rendered here based on `screen` */}
			<StatusBar style={isDarkMode ? 'light' : 'dark'} />
		</View>
	);
}

export default function App() {
	return (
		<ThemeProvider>
			<AppContent />
		</ThemeProvider>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#fff',
		alignItems: 'stretch',
		justifyContent: 'center',
	},
});

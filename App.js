import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, BackHandler } from 'react-native';
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
	const [navigationHistory, setNavigationHistory] = useState(['Login']); // Track navigation history
	const { colors, isDarkMode } = useTheme();

	const handleLogin = (userPayload) => {
		// store user and navigate to Home
		setUser(userPayload);
		setScreen('Home');
		setNavigationHistory(['Home']); // Reset history on login
	};

	// general navigation helper that accepts optional params
	const handleNavigate = (name, params = null) => {
		setScreenParams(params);
		setScreen(name);
		// Add to navigation history
		setNavigationHistory(prev => [...prev, name]);
	};

	// Handle back navigation (used by both hardware back button and onBack callbacks)
	const handleBack = () => {
		if (navigationHistory.length > 1) {
			// Go back to previous screen
			const newHistory = [...navigationHistory];
			newHistory.pop(); // Remove current screen
			const previousScreen = newHistory[newHistory.length - 1];
			
			setNavigationHistory(newHistory);
			setScreen(previousScreen);
			setScreenParams(null); // Clear params when going back
			return true;
		}
		return false;
	};

	// Handle hardware back button
	useEffect(() => {
		const backAction = () => {
			return handleBack();
		};

		const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

		return () => backHandler.remove();
	}, [navigationHistory]);

	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			{screen === 'Login' && <Login onLogin={handleLogin} onNavigate={handleNavigate} />}
			{screen === 'Signup' && <Signup onNavigate={handleNavigate} />}
			{screen === 'Home' && <Home onNavigate={handleNavigate} user={user} />}
			{screen === 'Notifications' && (
				<HealthNotifications onNavigate={handleNavigate} onBack={handleBack} user={user} />
			)}
			{screen === 'QR' && (
				<QRScreen
					onNavigate={handleNavigate}
					onBack={handleBack}
					user={user}
				/>
			)}
			{screen === 'Trends' && (
				<Trends
					metric={(screenParams && screenParams.metric) || 'Blood Pressure'}
					user={user}
					onBack={handleBack}
				/>
			)}
			{screen === 'Profile' && (
				<ProfileScreen
					onNavigate={handleNavigate}
					onBack={handleBack}
					user={user}
				/>
			)}
			{screen === 'ScanLogs' && (
				<ScanLogs
					onNavigate={handleNavigate}
					onBack={handleBack}
					user={user}
				/>
			)}
			{screen === 'Settings' && <Settings onBack={handleBack} onNavigate={handleNavigate} user={user} />}
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

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
import Signup from './signup'; 
import Settings from './settings';
import ScanLogs from './scanlogs';

function AppContent() {
	const [screen, setScreen] = useState('Login'); 
	const [user, setUser] = useState(null);
	const [screenParams, setScreenParams] = useState(null);
	const [navigationHistory, setNavigationHistory] = useState(['Login']); 
	const { colors, isDarkMode } = useTheme();

	const handleLogin = (userPayload) => {
		setUser(userPayload);
		setScreen('Home');
		setNavigationHistory(['Home']); 
	};

	const handleNavigate = (name, params = null) => {
		setScreenParams(params);
		setScreen(name);
		setNavigationHistory(prev => {
			const lastScreen = prev[prev.length - 1];
			if (lastScreen === name) {
				return prev;
			}
			return [...prev, name];
		});
	};

	const handleBack = () => {
		if (navigationHistory.length > 1) {
			const newHistory = [...navigationHistory];
			newHistory.pop(); 
			const previousScreen = newHistory[newHistory.length - 1];
			
			setNavigationHistory(newHistory);
			setScreen(previousScreen);
			setScreenParams(null); 
			return true;
		}
		return false;
	};

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

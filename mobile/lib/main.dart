import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:omlu/core/api_client.dart';
import 'package:omlu/core/auth_provider.dart';
import 'package:omlu/core/theme.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/screens/login_screen.dart';
import 'package:omlu/screens/main_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      statusBarBrightness: Brightness.light,
    ),
  );

  const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://omlu-core.onrender.com/api/v1',
);
final apiClient = ApiClient(baseUrl: apiBaseUrl);

  runApp(
    MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: apiClient),
        ChangeNotifierProvider(
          create: (_) => AuthProvider(api: apiClient)..init(),
        ),
      ],
      child: const OmluApp(),
    ),
  );
}

class OmluApp extends StatelessWidget {
  const OmluApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OMLU',
      theme: omluTheme(),
      debugShowCheckedModeBanner: false,
      home: const AuthGate(),
      routes: {
        '/home': (context) => const AuthGate(),
      },
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, child) {
        if (auth.isLoading) {
          return const Scaffold(
            backgroundColor: OmluColors.background,
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }

        if (auth.isAuthenticated) {
          return const MainShell();
        }

        return const LoginScreen();
      },
    );
  }
}

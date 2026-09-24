import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/auth_provider.dart';
import 'package:omlu/widgets/omlu_text_field.dart';
import 'package:omlu/widgets/omlu_button.dart';
import 'package:omlu/screens/signup_screen.dart';

class LoginScreen extends StatefulWidget {
  final String? returnTo;

  const LoginScreen({super.key, this.returnTo});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;
  String? _emailError;
  String? _passwordError;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    setState(() {
      _emailError = _emailController.text.trim().isEmpty ? 'Required' : null;
      _passwordError = _passwordController.text.isEmpty ? 'Required' : null;
      _errorMessage = null;
    });

    if (_emailError != null || _passwordError != null) return;

    setState(() {
      _isLoading = true;
    });

    try {
      final auth = context.read<AuthProvider>();
      await auth.login(
        _emailController.text.trim(),
        _passwordController.text,
      );
      if (!mounted) return;
      if (widget.returnTo != null) {
        Navigator.of(context).pushReplacementNamed(widget.returnTo!);
      } else {
        Navigator.of(context).pushReplacementNamed('/home');
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OmluColors.background,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: OmluSpacing.xl),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'omlu',
                  textAlign: TextAlign.center,
                  style: OmluTypography.display.copyWith(
                    fontSize: 48,
                    letterSpacing: -1.5,
                  ),
                ),
                const SizedBox(height: OmluSpacing.xs),
                Text(
                  'Our Memories Link Us.',
                  textAlign: TextAlign.center,
                  style: OmluTypography.bodyLarge.copyWith(
                    color: OmluColors.textSecondary,
                  ),
                ),
                const SizedBox(height: OmluSpacing.xxl),
                if (_errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: OmluSpacing.md),
                    child: Text(
                      _errorMessage!,
                      style: OmluTypography.bodySmall.copyWith(
                        color: OmluColors.error,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                OmluTextField(
                  controller: _emailController,
                  hint: 'Email or Username',
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  errorText: _emailError,
                ),
                const SizedBox(height: OmluSpacing.md),
                OmluTextField(
                  controller: _passwordController,
                  hint: 'Password',
                  isPassword: true,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (_) => _login(),
                  errorText: _passwordError,
                ),
                const SizedBox(height: OmluSpacing.xl),
                OmluButton(
                  text: 'Log In',
                  onPressed: _login,
                  isLoading: _isLoading,
                ),
                const SizedBox(height: OmluSpacing.xl),
                TextButton(
                  onPressed: () {
                    Navigator.of(context).pushReplacement(
                      MaterialPageRoute(
                        builder: (_) => SignupScreen(returnTo: widget.returnTo),
                      ),
                    );
                  },
                  child: Text(
                    "Don't have an account? Sign up",
                    style: OmluTypography.body.copyWith(
                      color: OmluColors.linkBlue,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

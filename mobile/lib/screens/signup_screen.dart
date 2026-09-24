import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/auth_provider.dart';
import 'package:omlu/widgets/omlu_text_field.dart';
import 'package:omlu/widgets/omlu_button.dart';
import 'package:omlu/screens/login_screen.dart';

class SignupScreen extends StatefulWidget {
  final String? returnTo;

  const SignupScreen({super.key, this.returnTo});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _displayNameController = TextEditingController();
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  
  bool _isLoading = false;
  String? _errorMessage;
  
  String? _displayNameError;
  String? _usernameError;
  String? _emailError;
  String? _passwordError;

  @override
  void dispose() {
    _displayNameController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signup() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    final email = _emailController.text.trim();
    final displayName = _displayNameController.text.trim();

    setState(() {
      _displayNameError = displayName.isEmpty ? 'Required' : null;
      
      if (username.isEmpty) {
        _usernameError = 'Required';
      } else if (username.length < 3) {
        _usernameError = 'Must be at least 3 characters';
      } else if (!RegExp(r'^[a-z0-9_]+$').hasMatch(username)) {
        _usernameError = 'Lowercase alphanumeric and underscores only';
      } else {
        _usernameError = null;
      }

      if (email.isEmpty) {
        _emailError = 'Required';
      } else if (!email.contains('@')) {
        _emailError = 'Invalid email';
      } else {
        _emailError = null;
      }

      if (password.isEmpty) {
        _passwordError = 'Required';
      } else if (password.length < 6) {
        _passwordError = 'Password must be at least 6 characters';
      } else {
        _passwordError = null;
      }

      _errorMessage = null;
    });

    if (_displayNameError != null || 
        _usernameError != null || 
        _emailError != null || 
        _passwordError != null) {
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final auth = context.read<AuthProvider>();
      await auth.signup(
        email: email,
        username: username,
        displayName: displayName,
        password: password,
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
                  controller: _displayNameController,
                  hint: 'Display Name',
                  textInputAction: TextInputAction.next,
                  errorText: _displayNameError,
                ),
                const SizedBox(height: OmluSpacing.md),
                OmluTextField(
                  controller: _usernameController,
                  hint: 'Username',
                  prefixIcon: const Padding(
                    padding: EdgeInsets.only(left: 16, top: 14),
                    child: Text('@', style: TextStyle(color: OmluColors.secondary, fontSize: 16)),
                  ),
                  textInputAction: TextInputAction.next,
                  errorText: _usernameError,
                ),
                const SizedBox(height: OmluSpacing.md),
                OmluTextField(
                  controller: _emailController,
                  hint: 'Email',
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
                  onSubmitted: (_) => _signup(),
                  errorText: _passwordError,
                ),
                const SizedBox(height: OmluSpacing.xl),
                OmluButton(
                  text: 'Create Account',
                  onPressed: _signup,
                  isLoading: _isLoading,
                ),
                const SizedBox(height: OmluSpacing.xl),
                TextButton(
                  onPressed: () {
                    Navigator.of(context).pushReplacement(
                      MaterialPageRoute(
                        builder: (_) => LoginScreen(returnTo: widget.returnTo),
                      ),
                    );
                  },
                  child: Text(
                    "Already have an account? Log in",
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

/// OMLU Auth Provider
///
/// Manages authentication state: login, signup, logout, token persistence.
/// Uses flutter_secure_storage for JWT token storage.
library;

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:omlu/core/api_client.dart';
import 'package:omlu/core/models.dart';

const _tokenKey = 'omlu_auth_token';

class AuthProvider extends ChangeNotifier {
  final ApiClient api;
  final FlutterSecureStorage _storage;

  User? _user;
  bool _isLoading = true;
  String? _error;

  AuthProvider({required this.api, FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  User? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null;
  String? get error => _error;

  /// Initialize auth state from stored token.
  Future<void> init() async {
    _isLoading = true;
    notifyListeners();

    try {
      final savedToken = await _storage.read(key: _tokenKey);
      if (savedToken != null && savedToken.isNotEmpty) {
        api.setToken(savedToken);
        final userData = await api.get<Map<String, dynamic>>('/auth/me');
        _user = User.fromJson(userData);
      }
    } catch (e) {
      // Token expired or invalid
      await _storage.delete(key: _tokenKey);
      api.setToken(null);
      _user = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Log in with email/username and password.
  Future<User> login(String emailOrUsername, String password) async {
    _error = null;
    notifyListeners();

    try {
      final response = await api.post<Map<String, dynamic>>(
        '/auth/login',
        body: {
          'email_or_username': emailOrUsername,
          'password': password,
        },
      );

      final token = response['access_token'] as String;
      final user = User.fromJson(response['user'] as Map<String, dynamic>);

      await _storage.write(key: _tokenKey, value: token);
      api.setToken(token);
      _user = user;
      notifyListeners();
      return user;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      rethrow;
    }
  }

  /// Sign up a new user.
  Future<User> signup({
    required String email,
    required String username,
    required String displayName,
    required String password,
  }) async {
    _error = null;
    notifyListeners();

    try {
      final response = await api.post<Map<String, dynamic>>(
        '/auth/signup',
        body: {
          'email': email,
          'username': username,
          'display_name': displayName,
          'password': password,
        },
      );

      final token = response['access_token'] as String;
      final user = User.fromJson(response['user'] as Map<String, dynamic>);

      await _storage.write(key: _tokenKey, value: token);
      api.setToken(token);
      _user = user;
      notifyListeners();
      return user;
    } on ApiException catch (e) {
      _error = e.message;
      notifyListeners();
      rethrow;
    }
  }

  /// Log out and clear stored token.
  Future<void> logout() async {
    await _storage.delete(key: _tokenKey);
    api.setToken(null);
    _user = null;
    _error = null;
    notifyListeners();
  }

  /// Refresh user data from the server.
  Future<void> refreshUser() async {
    if (_user == null) return;
    try {
      final userData = await api.get<Map<String, dynamic>>('/auth/me');
      _user = User.fromJson(userData);
      notifyListeners();
    } catch (_) {
      // Silently ignore refresh failures
    }
  }

  /// Update user fields locally (after a successful profile edit).
  void updateUserLocally(User updatedUser) {
    _user = updatedUser;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}

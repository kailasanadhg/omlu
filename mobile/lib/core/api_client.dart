/// OMLU API Client
///
/// Centralized HTTP client for all backend API communication.
/// Handles authentication headers, JSON parsing, and error handling.
library;

import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final int statusCode;
  final String message;

  const ApiException({required this.statusCode, required this.message});

  @override
  String toString() => 'ApiException($statusCode): $message';

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
}

class ApiClient {
  final String baseUrl;
  String? _token;
  final http.Client _client;

  ApiClient({
    required this.baseUrl,
    http.Client? client,
  }) : _client = client ?? http.Client();

  void setToken(String? token) {
    _token = token;
  }

  String? get token => _token;

  Map<String, String> get _headers {
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };
    if (_token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  Future<T> get<T>(
    String endpoint, {
    T Function(dynamic)? parser,
  }) async {
    final response = await _client.get(
      Uri.parse('$baseUrl$endpoint'),
      headers: _headers,
    );
    return _handleResponse(response, parser: parser);
  }

  Future<T> post<T>(
    String endpoint, {
    Map<String, dynamic>? body,
    T Function(dynamic)? parser,
  }) async {
    final response = await _client.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response, parser: parser);
  }

  Future<T> put<T>(
    String endpoint, {
    Map<String, dynamic>? body,
    T Function(dynamic)? parser,
  }) async {
    final response = await _client.put(
      Uri.parse('$baseUrl$endpoint'),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response, parser: parser);
  }

  Future<T> patch<T>(
    String endpoint, {
    Map<String, dynamic>? body,
    T Function(dynamic)? parser,
  }) async {
    final response = await _client.patch(
      Uri.parse('$baseUrl$endpoint'),
      headers: _headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response, parser: parser);
  }

  Future<void> delete(String endpoint) async {
    final response = await _client.delete(
      Uri.parse('$baseUrl$endpoint'),
      headers: _headers,
    );
    if (response.statusCode != 200 && response.statusCode != 204) {
      _throwError(response);
    }
  }

  /// Upload a file directly to Cloudinary using multipart form.
  Future<Map<String, dynamic>> uploadToCloudinary({
    required String uploadUrl,
    required File file,
    required String apiKey,
    required String timestamp,
    required String signature,
    required String folder,
    required String publicId,
    bool? overwrite,
    void Function(double)? onProgress,
  }) async {
    final request = http.MultipartRequest('POST', Uri.parse(uploadUrl));
    request.fields['api_key'] = apiKey;
    request.fields['timestamp'] = timestamp;
    request.fields['signature'] = signature;
    request.fields['folder'] = folder;
    request.fields['public_id'] = publicId;
    if (overwrite == false) {
      request.fields['overwrite'] = 'false';
    }

    final fileStream = http.ByteStream(file.openRead());
    final fileLength = await file.length();
    request.files.add(http.MultipartFile(
      'file',
      fileStream,
      fileLength,
      filename: publicId,
    ));

    final streamedResponse = await request.send();
    final responseBody = await streamedResponse.stream.bytesToString();

    if (streamedResponse.statusCode >= 200 &&
        streamedResponse.statusCode < 300) {
      return jsonDecode(responseBody) as Map<String, dynamic>;
    }

    throw ApiException(
      statusCode: streamedResponse.statusCode,
      message: 'Upload failed',
    );
  }

  T _handleResponse<T>(
    http.Response response, {
    T Function(dynamic)? parser,
  }) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (response.statusCode == 204 || response.body.isEmpty) {
        return {} as T;
      }
      final decoded = jsonDecode(response.body);
      if (parser != null) {
        return parser(decoded);
      }
      return decoded as T;
    }
    _throwError(response);
  }

  Never _throwError(http.Response response) {
    String message = 'Request failed with status ${response.statusCode}';
    try {
      final errorJson = jsonDecode(response.body);
      if (errorJson is Map && errorJson.containsKey('detail')) {
        final detail = errorJson['detail'];
        message = detail is String ? detail : jsonEncode(detail);
      }
    } catch (_) {
      // Non-JSON error
    }
    throw ApiException(statusCode: response.statusCode, message: message);
  }

  void dispose() {
    _client.close();
  }
}

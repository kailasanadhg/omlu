import 'dart:collection';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:omlu/core/api_client.dart';

enum UploadStatus { queued, signing, uploading, creating, failed, confirmed }

class PendingUpload {
  final String id;
  final String spaceId;
  final String spaceName;
  final String filePath;
  UploadStatus status;
  String? errorMessage;
  double progress;

  PendingUpload({
    required this.id,
    required this.spaceId,
    required this.spaceName,
    required this.filePath,
    this.status = UploadStatus.queued,
    this.errorMessage,
    this.progress = 0.0,
  });
}

class UploadQueueProvider extends ChangeNotifier {
  final ApiClient _api;
  final List<PendingUpload> _queue = [];
  bool _isProcessing = false;

  UploadQueueProvider({required ApiClient api}) : _api = api {
    _init();
  }

  UnmodifiableListView<PendingUpload> get queue => UnmodifiableListView(_queue);

  void _init() {
    processQueue();
  }

  void enqueue({
    required String spaceId,
    required String spaceName,
    required String filePath,
  }) {
    final upload = PendingUpload(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      spaceId: spaceId,
      spaceName: spaceName,
      filePath: filePath,
    );
    _queue.add(upload);
    notifyListeners();
    processQueue();
  }

  void retry(String id) {
    final upload = _queue.cast<PendingUpload?>().firstWhere(
      (u) => u?.id == id,
      orElse: () => null,
    );
    if (upload != null && upload.status == UploadStatus.failed) {
      upload.status = UploadStatus.queued;
      upload.errorMessage = null;
      notifyListeners();
      processQueue();
    }
  }

  void remove(String id) {
    _queue.removeWhere((u) => u.id == id);
    notifyListeners();
  }

  Future<void> processQueue() async {
    if (_isProcessing) return;
    _isProcessing = true;

    while (true) {
      final upload = _queue.cast<PendingUpload?>().firstWhere(
        (u) => u?.status == UploadStatus.queued,
        orElse: () => null,
      );

      if (upload == null) break;

      try {
        // 1. Sign
        upload.status = UploadStatus.signing;
        notifyListeners();

        final signResponse = await _api.post<Map<String, dynamic>>(
          '/uploads/sign',
          body: {
            'content_type': 'image/jpeg', // Assuming jpeg from camera
            'folder': 'spaces/${upload.spaceId}',
          },
        );

        final signature = signResponse['signature'] as String;
        final timestamp = signResponse['timestamp'].toString();
        final apiKey = signResponse['api_key'] as String;
        final folder = signResponse['folder'] as String;
        final publicId = signResponse['public_id'] as String;
        final uploadUrl = signResponse['upload_url'] as String;

        // 2. Upload
        upload.status = UploadStatus.uploading;
        notifyListeners();

        final uploadResult = await _api.uploadToCloudinary(
          uploadUrl: uploadUrl,
          file: File(upload.filePath),
          apiKey: apiKey,
          timestamp: timestamp,
          signature: signature,
          folder: folder,
          publicId: publicId,
        );

        final secureUrl = uploadResult['secure_url'] as String;
        final format = uploadResult['format'] as String;
        final width = uploadResult['width'] as int;
        final height = uploadResult['height'] as int;

        // 3. Create Memory
        upload.status = UploadStatus.creating;
        notifyListeners();

        await _api.post<Map<String, dynamic>>(
          '/spaces/${upload.spaceId}/memories',
          body: {
            'image_url': secureUrl,
            'format': format,
            'width': width,
            'height': height,
          },
        );

        upload.status = UploadStatus.confirmed;
        notifyListeners();

        // Clean up confirmed after a short delay
        Future.delayed(const Duration(seconds: 3), () {
          _queue.removeWhere((u) => u.id == upload.id);
          notifyListeners();
        });
      } catch (e) {
        upload.status = UploadStatus.failed;
        upload.errorMessage = 'Failed to upload photo. Please try again.';
        notifyListeners();
      }
    }

    _isProcessing = false;
  }
}

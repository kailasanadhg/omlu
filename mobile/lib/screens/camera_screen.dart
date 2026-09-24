import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/upload_queue.dart';

class CameraScreen extends StatefulWidget {
  final String spaceId;
  final String spaceName;

  const CameraScreen({super.key, required this.spaceId, required this.spaceName});

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen>
    with SingleTickerProviderStateMixin {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];
  bool _isReady = false;
  bool _isFrontCamera = false;
  String? _error;
  int _capturedCount = 0;
  String? _lastCapturedPath;

  late AnimationController _flashController;
  late Animation<double> _flashAnimation;

  @override
  void initState() {
    super.initState();
    // Hide status bar
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersive);

    _flashController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
    _flashAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _flashController, curve: Curves.easeOut));

    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        setState(() => _error = 'No cameras available');
        return;
      }
      await _setupController(_cameras.first);
    } catch (e) {
      setState(() => _error = 'Failed to initialize camera');
    }
  }

  Future<void> _setupController(CameraDescription camera) async {
    if (_controller != null) {
      await _controller!.dispose();
    }

    _controller = CameraController(
      camera,
      ResolutionPreset.high,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );

    _isFrontCamera = camera.lensDirection == CameraLensDirection.front;

    try {
      await _controller!.initialize();
      if (mounted) {
        setState(() => _isReady = true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Camera permission denied');
      }
    }
  }

  Future<void> _flipCamera() async {
    if (_cameras.length < 2) return;

    final currentLensDirection = _controller?.description.lensDirection;
    final newCamera = _cameras.firstWhere(
      (c) => c.lensDirection != currentLensDirection,
      orElse: () => _cameras.first,
    );

    setState(() => _isReady = false);
    await _setupController(newCamera);
  }

  Future<void> _takePicture() async {
    if (_controller == null || !_controller!.value.isInitialized) return;
    if (_controller!.value.isTakingPicture) return;

    HapticFeedback.mediumImpact();

    // Flash effect
    _flashController.forward().then((_) => _flashController.reverse());

    try {
      final file = await _controller!.takePicture();

      setState(() {
        _lastCapturedPath = file.path;
        _capturedCount++;
      });

      if (!mounted) return;

      // Enqueue upload
      context.read<UploadQueueProvider>().enqueue(
        spaceId: widget.spaceId,
        spaceName: widget.spaceName,
        filePath: file.path,
      );
    } catch (e) {
      // Ignore capture errors for minimal UI disruption
    }
  }

  @override
  void dispose() {
    SystemChrome.setEnabledSystemUIMode(
      SystemUiMode.manual,
      overlays: SystemUiOverlay.values,
    );
    _controller?.dispose();
    _flashController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          iconTheme: const IconThemeData(color: Colors.white),
        ),
        body: Center(
          child: Text(_error!, style: const TextStyle(color: Colors.white)),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Viewfinder
          if (_isReady && _controller != null)
            Transform.scale(
              scale: _isFrontCamera
                  ? -1
                  : 1, // Mirror fix for front camera if needed, wait, camera package usually mirrors correctly for display, but sometimes needs Transform.
              // Actually, camera package handles display mirroring. Let's not mirror unless necessary.
              // Wait, the instructions say "Front camera mirror flip". Let's wrap in Transform for front cam, scaling x by -1.
              alignment: Alignment.center,
              child: Transform(
                alignment: Alignment.center,
                transform: _isFrontCamera
                    ? Matrix4.rotationY(3.14159)
                    : Matrix4.identity(),
                child: Center(child: CameraPreview(_controller!)),
              ),
            )
          else
            const Center(child: CircularProgressIndicator(color: Colors.white)),

          // Flash overlay
          AnimatedBuilder(
            animation: _flashAnimation,
            builder: (context, child) {
              return IgnorePointer(
                child: Opacity(
                  opacity: _flashAnimation.value,
                  child: Container(color: Colors.white),
                ),
              );
            },
          ),

          // Top Chrome
          Positioned(
            top: MediaQuery.of(context).padding.top + 16,
            left: 16,
            right: 16,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white, size: 28),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    widget.spaceName,
                    style: OmluTypography.body.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(
                    Icons.flip_camera_ios,
                    color: Colors.white,
                    size: 28,
                  ),
                  onPressed: _flipCamera,
                ),
              ],
            ),
          ),

          // Captured count badge
          if (_capturedCount > 0)
            Positioned(
              top: MediaQuery.of(context).padding.top + 72,
              right: 16,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: OmluColors.primary,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  '$_capturedCount captured',
                  style: OmluTypography.bodySmall.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),

          // Bottom Chrome
          Positioned(
            bottom: 48,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Thumbnail
                SizedBox(
                  width: 64,
                  height: 64,
                  child: _lastCapturedPath != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.file(
                            File(_lastCapturedPath!),
                            fit: BoxFit.cover,
                          ),
                        )
                      : null,
                ),

                // Shutter Button
                GestureDetector(
                  onTap: _takePicture,
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 4),
                    ),
                    child: Center(
                      child: Container(
                        width: 56,
                        height: 56,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ),

                // Spacer to balance thumbnail
                const SizedBox(width: 64),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

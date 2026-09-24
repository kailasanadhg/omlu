import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:omlu/core/api_client.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/models.dart';
import 'package:omlu/core/auth_provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:omlu/screens/space_detail_screen.dart';

class JoinSpaceScreen extends StatefulWidget {
  final String inviteCode;

  const JoinSpaceScreen({super.key, required this.inviteCode});

  @override
  State<JoinSpaceScreen> createState() => _JoinSpaceScreenState();
}

class _JoinSpaceScreenState extends State<JoinSpaceScreen> {
  InvitePreview? _preview;
  bool _isLoading = true;
  bool _isJoining = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchPreview();
  }

  Future<void> _fetchPreview() async {
    setState(() => _isLoading = true);
    try {
      final api = context.read<ApiClient>();
      final response = await api.get<Map<String, dynamic>>('/spaces/join/${widget.inviteCode}');
      setState(() {
        _preview = InvitePreview.fromJson(response);
        _isLoading = false;
      });
      
      if (_preview!.isMember) {
        _navigateToSpace(_preview!.id);
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _joinSpace() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      // Typically navigate to login/signup with a return_to path
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please log in to join a space')),
      );
      return;
    }

    setState(() => _isJoining = true);
    try {
      final api = context.read<ApiClient>();
      await api.post('/spaces/join/${widget.inviteCode}');
      if (mounted) {
        _navigateToSpace(_preview!.id);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isJoining = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to join: $e')),
        );
      }
    }
  }

  void _navigateToSpace(String spaceId) {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => SpaceDetailScreen(spaceId: spaceId)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OmluColors.background,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: const IconThemeData(color: OmluColors.primary),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: OmluColors.primary))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(OmluSpacing.xl),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.error_outline, size: 64, color: OmluColors.error),
                        const SizedBox(height: OmluSpacing.md),
                        Text('Invalid Invite', style: OmluTypography.pageTitle),
                        const SizedBox(height: OmluSpacing.sm),
                        Text(
                          'This invite code appears to be invalid or expired.',
                          style: OmluTypography.body,
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                )
              : SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(OmluSpacing.xl),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Container(
                          height: 200,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(OmluRadii.md),
                            gradient: _preview!.coverUrl == null
                                ? const LinearGradient(
                                    colors: [OmluColors.tertiary, OmluColors.secondaryLight],
                                  )
                                : null,
                          ),
                          child: _preview!.coverUrl != null
                              ? ClipRRect(
                                  borderRadius: BorderRadius.circular(OmluRadii.md),
                                  child: CachedNetworkImage(
                                    imageUrl: OmluImageTransform.optimize(_preview!.coverUrl, type: 'cover'),
                                    fit: BoxFit.cover,
                                  ),
                                )
                              : const Center(
                                  child: Icon(Icons.image, size: 64, color: OmluColors.surface),
                                ),
                        ),
                        const SizedBox(height: OmluSpacing.xl),
                        Text(
                          _preview!.name,
                          style: OmluTypography.display,
                          textAlign: TextAlign.center,
                        ),
                        if (_preview!.description != null) ...[
                          const SizedBox(height: OmluSpacing.sm),
                          Text(
                            _preview!.description!,
                            style: OmluTypography.bodyLarge,
                            textAlign: TextAlign.center,
                          ),
                        ],
                        const SizedBox(height: OmluSpacing.lg),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.group_outlined, size: 20, color: OmluColors.textSecondary),
                            const SizedBox(width: OmluSpacing.xxs),
                            Text('${_preview!.membersCount} members', style: OmluTypography.bodySmall),
                            const SizedBox(width: OmluSpacing.md),
                            const Icon(Icons.photo_library_outlined, size: 20, color: OmluColors.textSecondary),
                            const SizedBox(width: OmluSpacing.xxs),
                            Text('${_preview!.memoriesCount} memories', style: OmluTypography.bodySmall),
                          ],
                        ),
                        const Spacer(),
                        ElevatedButton(
                          onPressed: _isJoining ? null : _joinSpace,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: OmluColors.primary,
                            foregroundColor: OmluColors.textInverse,
                            padding: const EdgeInsets.symmetric(vertical: OmluSpacing.md),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(OmluRadii.full),
                            ),
                          ),
                          child: _isJoining
                              ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(color: OmluColors.surface, strokeWidth: 2),
                                )
                              : const Text('Join Space', style: OmluTypography.button),
                        ),
                      ],
                    ),
                  ),
                ),
    );
  }
}

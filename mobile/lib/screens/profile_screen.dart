import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:omlu/core/api_client.dart';
import 'package:omlu/core/auth_provider.dart';
import 'package:omlu/core/models.dart';
import 'package:omlu/core/design_system.dart';

class ProfileScreen extends StatefulWidget {
  final String username;

  const ProfileScreen({super.key, required this.username});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  UserProfile? _profile;
  List<Memory>? _memories;
  bool _isLoading = true;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _hasError = false;
    });

    try {
      final api = context.read<ApiClient>();

      final profileData = await api.get<Map<String, dynamic>>(
        '/users/@${widget.username}',
      );
      final profile = UserProfile.fromJson(profileData);

      final memoriesData = await api.get<List<dynamic>>(
        '/memories/user/${profile.id}',
      );
      final memories = memoriesData.map((e) => Memory.fromJson(e)).toList();

      setState(() {
        _profile = profile;
        _memories = memories;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _hasError = true;
        _isLoading = false;
      });
    }
  }

  void _editProfile() {
    // Navigate to edit profile
    // Navigator.pushNamed(context, '/edit_profile').then((_) => _fetchData());
  }

  void _logOut() async {
    await context.read<AuthProvider>().logout();
    // Assuming auth guard handles redirect to login
  }

  Widget _buildGrid() {
    if (_memories == null || _memories!.isEmpty) {
      return SliverFillRemaining(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.photo_library_outlined,
                size: 48,
                color: OmluColors.textSecondary,
              ),
              const SizedBox(height: 16),
              Text('No memories yet', style: OmluTypography.bodyLarge),
              if (_profile != null && !_profile!.isSelf) ...[
                const SizedBox(height: 8),
                Text(
                  'Or you don\'t share any spaces with ${_profile!.displayName}',
                  style: OmluTypography.bodySmall.copyWith(
                    color: OmluColors.textSecondary,
                  ),
                ),
              ],
            ],
          ),
        ),
      );
    }

    return SliverGrid(
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 2,
        crossAxisSpacing: 2,
      ),
      delegate: SliverChildBuilderDelegate((context, index) {
        final memory = _memories![index];
        final hasMedia = memory.mediaItems.isNotEmpty;

        return GestureDetector(
          onTap: () {
            // Open memory viewer
            // Navigator.pushNamed(context, '/memory', arguments: memory.id);
          },
          child: hasMedia
              ? CachedNetworkImage(
                  imageUrl: memory.mediaItems.first.secureUrl,
                  fit: BoxFit.cover,
                  placeholder: (context, url) =>
                      Container(color: OmluColors.shimmerBase),
                  errorWidget: (context, url, error) => Container(
                    color: OmluColors.shimmerBase,
                    child: const Icon(
                      Icons.broken_image,
                      color: OmluColors.textSecondary,
                    ),
                  ),
                )
              : Container(
                  color: OmluColors.shimmerBase,
                  child: const Center(
                    child: Icon(Icons.notes, color: OmluColors.textSecondary),
                  ),
                ),
        );
      }, childCount: _memories!.length),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: OmluColors.background,
        body: Center(
          child: CircularProgressIndicator(color: OmluColors.primary),
        ),
      );
    }

    if (_hasError || _profile == null) {
      return Scaffold(
        backgroundColor: OmluColors.background,
        appBar: AppBar(backgroundColor: OmluColors.background, elevation: 0),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 48,
                color: OmluColors.textSecondary,
              ),
              const SizedBox(height: 16),
              Text('Failed to load profile', style: OmluTypography.bodyLarge),
              TextButton(onPressed: _fetchData, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final profile = _profile!;
    final isSelf = profile.isSelf;

    return Scaffold(
      backgroundColor: OmluColors.background,
      appBar: AppBar(
        title: Text(profile.username, style: OmluTypography.bodyLarge),
        backgroundColor: OmluColors.background,
        elevation: 0,
      ),
      body: RefreshIndicator(
        onRefresh: _fetchData,
        color: OmluColors.primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 40,
                      backgroundColor: OmluColors.shimmerBase,
                      backgroundImage: profile.avatarUrl != null
                          ? CachedNetworkImageProvider(profile.avatarUrl!)
                          : null,
                      child: profile.avatarUrl == null
                          ? Text(
                              profile.displayName.isNotEmpty
                                  ? profile.displayName[0].toUpperCase()
                                  : '?',
                              style: OmluTypography.pageTitle.copyWith(
                                color: OmluColors.textSecondary,
                              ),
                            )
                          : null,
                    ),
                    const SizedBox(height: 16),
                    Text(profile.displayName, style: OmluTypography.pageTitle),
                    const SizedBox(height: 4),
                    Text(
                      '@${profile.username}',
                      style: OmluTypography.bodySmall.copyWith(
                        color: OmluColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 16),

                    if (profile.bio != null && profile.bio!.isNotEmpty) ...[
                      Text(
                        profile.bio!,
                        style: OmluTypography.body,
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                    ],

                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '${profile.memoriesCount} memories',
                          style: OmluTypography.body.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 8.0),
                          child: Text('·'),
                        ),
                        Text(
                          '${profile.spacesCount} spaces',
                          style: OmluTypography.body.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),

                    if (isSelf) ...[
                      const SizedBox(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          OutlinedButton(
                            onPressed: _editProfile,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: OmluColors.textPrimary,
                              side: const BorderSide(color: OmluColors.border),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            child: const Text('Edit Profile'),
                          ),
                          const SizedBox(width: 16),
                          OutlinedButton(
                            onPressed: _logOut,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: OmluColors.error,
                              side: const BorderSide(color: OmluColors.error),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            child: const Text('Log Out'),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 24),
                    const Divider(height: 1, color: OmluColors.border),
                  ],
                ),
              ),
            ),
            _buildGrid(),
          ],
        ),
      ),
    );
  }
}

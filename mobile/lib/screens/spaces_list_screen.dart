import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:omlu/core/api_client.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/models.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:omlu/screens/space_detail_screen.dart';
import 'package:omlu/screens/create_space_screen.dart';

class SpacesListScreen extends StatefulWidget {
  const SpacesListScreen({super.key});

  @override
  State<SpacesListScreen> createState() => _SpacesListScreenState();
}

class _SpacesListScreenState extends State<SpacesListScreen> {
  List<Space> _spaces = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchSpaces();
  }

  Future<void> _fetchSpaces() async {
    setState(() => _isLoading = true);
    try {
      final api = context.read<ApiClient>();
      final response = await api.get<List<dynamic>>('/spaces/');
      setState(() {
        _spaces = response.map((e) => Space.fromJson(e as Map<String, dynamic>)).toList();
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load spaces: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OmluColors.background,
      appBar: AppBar(
        title: const Text('Spaces', style: OmluTypography.pageTitle),
        backgroundColor: OmluColors.background,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.add, color: OmluColors.primary),
            onPressed: () async {
              final result = await Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CreateSpaceScreen()),
              );
              if (result == true) {
                _fetchSpaces();
              }
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: OmluColors.primary))
          : RefreshIndicator(
              onRefresh: _fetchSpaces,
              color: OmluColors.primary,
              child: _spaces.isEmpty
                  ? ListView(
                      children: const [
                        Padding(
                          padding: EdgeInsets.all(OmluSpacing.xl),
                          child: Center(
                            child: Text(
                              'You haven\'t joined any spaces yet.',
                              style: OmluTypography.bodyLarge,
                            ),
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(OmluSpacing.md),
                      itemCount: _spaces.length,
                      separatorBuilder: (context, index) => const SizedBox(height: OmluSpacing.md),
                      itemBuilder: (context, index) {
                        final space = _spaces[index];
                        return InkWell(
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => SpaceDetailScreen(spaceId: space.id),
                              ),
                            );
                          },
                          borderRadius: BorderRadius.circular(OmluRadii.md),
                          child: Container(
                            decoration: BoxDecoration(
                              color: OmluColors.surface,
                              borderRadius: BorderRadius.circular(OmluRadii.md),
                              border: Border.all(color: OmluColors.borderLight),
                            ),
                            padding: const EdgeInsets.all(OmluSpacing.sm),
                            child: Row(
                              children: [
                                Container(
                                  width: 80,
                                  height: 80,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(OmluRadii.sm),
                                    gradient: space.coverUrl == null
                                        ? const LinearGradient(
                                            colors: [OmluColors.tertiary, OmluColors.secondaryLight],
                                          )
                                        : null,
                                  ),
                                  child: space.coverUrl != null
                                      ? ClipRRect(
                                          borderRadius: BorderRadius.circular(OmluRadii.sm),
                                          child: CachedNetworkImage(
                                            imageUrl: OmluImageTransform.optimize(space.coverUrl, type: 'thumb'),
                                            fit: BoxFit.cover,
                                          ),
                                        )
                                      : Center(
                                          child: Text(
                                            space.name.isNotEmpty ? space.name[0].toUpperCase() : '?',
                                            style: const TextStyle(
                                              fontSize: 24,
                                              fontWeight: FontWeight.bold,
                                              color: OmluColors.surface,
                                            ),
                                          ),
                                        ),
                                ),
                                const SizedBox(width: OmluSpacing.md),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        space.name,
                                        style: OmluTypography.spaceTitle,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: OmluSpacing.xxs),
                                      if (space.description != null && space.description!.isNotEmpty) ...[
                                        Text(
                                          space.description!,
                                          style: OmluTypography.bodySmall,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: OmluSpacing.xs),
                                      ],
                                      Text(
                                        '${space.membersCount} members · ${space.memoriesCount} memories',
                                        style: OmluTypography.caption,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}

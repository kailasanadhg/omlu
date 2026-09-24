import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:omlu/core/api_client.dart';
import 'package:omlu/core/design_system.dart';
import 'package:omlu/core/models.dart';
import 'package:omlu/screens/space_detail_screen.dart';

class CreateSpaceScreen extends StatefulWidget {
  const CreateSpaceScreen({super.key});

  @override
  State<CreateSpaceScreen> createState() => _CreateSpaceScreenState();
}

class _CreateSpaceScreenState extends State<CreateSpaceScreen> {
  final _formKey = GlobalKey<FormState>();
  String _name = '';
  String _description = '';
  bool _isLoading = false;

  Future<void> _createSpace() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();

    setState(() => _isLoading = true);

    try {
      final api = context.read<ApiClient>();
      final response = await api.post<Map<String, dynamic>>(
        '/spaces/',
        body: {
          'name': _name,
          'description': _description.isEmpty ? null : _description,
        },
      );
      
      final newSpace = Space.fromJson(response);
      
      if (mounted) {
        Navigator.pop(context, true);
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => SpaceDetailScreen(spaceId: newSpace.id)),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create space: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: OmluColors.background,
      appBar: AppBar(
        title: const Text('Create Space', style: OmluTypography.pageTitle),
        backgroundColor: OmluColors.background,
        elevation: 0,
        iconTheme: const IconThemeData(color: OmluColors.primary),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(OmluSpacing.xl),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Space Name', style: OmluTypography.inputLabel),
                const SizedBox(height: OmluSpacing.xs),
                TextFormField(
                  decoration: InputDecoration(
                    hintText: 'E.g. Summer Trip 2024',
                    filled: true,
                    fillColor: OmluColors.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(OmluRadii.md),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  textCapitalization: TextCapitalization.words,
                  validator: (value) => value == null || value.trim().isEmpty ? 'Please enter a name' : null,
                  onSaved: (value) => _name = value?.trim() ?? '',
                ),
                const SizedBox(height: OmluSpacing.lg),
                Text('Description (Optional)', style: OmluTypography.inputLabel),
                const SizedBox(height: OmluSpacing.xs),
                TextFormField(
                  decoration: InputDecoration(
                    hintText: 'What is this space for?',
                    filled: true,
                    fillColor: OmluColors.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(OmluRadii.md),
                      borderSide: BorderSide.none,
                    ),
                  ),
                  maxLines: 3,
                  textCapitalization: TextCapitalization.sentences,
                  onSaved: (value) => _description = value?.trim() ?? '',
                ),
                const SizedBox(height: OmluSpacing.xl),
                Text(
                  'Spaces are private by default. Only people you invite can view and contribute to memories.',
                  style: OmluTypography.caption,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: OmluSpacing.xxl),
                ElevatedButton(
                  onPressed: _isLoading ? null : _createSpace,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: OmluColors.primary,
                    foregroundColor: OmluColors.textInverse,
                    padding: const EdgeInsets.symmetric(vertical: OmluSpacing.md),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(OmluRadii.full),
                    ),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: OmluColors.surface, strokeWidth: 2),
                        )
                      : const Text('Create Space', style: OmluTypography.button),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

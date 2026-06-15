from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('buses', '0002_add_is_active_date_creation'),
    ]

    operations = [
        migrations.CreateModel(
            name='Chauffeur',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nom', models.CharField(max_length=100, verbose_name='Nom')),
                ('prenom', models.CharField(max_length=100, verbose_name='Prénom')),
                ('telephone', models.CharField(max_length=20, verbose_name='Téléphone')),
                ('email', models.EmailField(blank=True, default='', verbose_name='Email')),
                ('numero_permis', models.CharField(max_length=50, unique=True, verbose_name='Numéro de permis')),
                ('statut', models.CharField(
                    choices=[('actif', 'Actif'), ('inactif', 'Inactif'), ('conge', 'En congé')],
                    default='actif', max_length=20, verbose_name='Statut'
                )),
                ('date_embauche', models.DateField(blank=True, null=True, verbose_name="Date d'embauche")),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
                ('bus_assigne', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='chauffeurs',
                    to='buses.bus',
                    verbose_name='Bus assigné'
                )),
            ],
            options={
                'verbose_name': 'Chauffeur',
                'verbose_name_plural': 'Chauffeurs',
                'ordering': ['nom', 'prenom'],
            },
        ),
    ]

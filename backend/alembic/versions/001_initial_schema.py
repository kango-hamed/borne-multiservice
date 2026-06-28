"""initial_schema

Revision ID: 001
Revises: None
Create Date: 2026-06-28 22:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Enums
    kiosk_status = sa.Enum('actif', 'maintenance', 'hors_ligne', name='kiosk_status')
    session_status = sa.Enum('active', 'expiree', 'terminee', name='session_status')
    color_mode = sa.Enum('nb', 'couleur', name='color_mode')
    print_job_status = sa.Enum(
        'en_creation', 'attente_paiement', 'paye', 'paiement_expire',
        'impression_en_cours', 'pret_a_retirer', 'recupere',
        name='print_job_status'
    )
    payment_provider = sa.Enum('orange_money', 'mtn', 'moov', 'wave', 'mock', name='payment_provider')
    payment_status = sa.Enum('initie', 'en_attente', 'confirme', 'echoue', name='payment_status')

    # kiosks
    op.create_table(
        'kiosks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('location_lat', sa.Float(), nullable=True),
        sa.Column('location_lng', sa.Float(), nullable=True),
        sa.Column('status', kiosk_status, nullable=False, server_default='actif'),
        sa.Column('printer_endpoint', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # sessions
    op.create_table(
        'sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('kiosk_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', session_status, nullable=False, server_default='active'),
        sa.ForeignKeyConstraint(['kiosk_id'], ['kiosks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_sessions_expiry_status', 'sessions', ['expires_at', 'status'])

    # print_jobs
    op.create_table(
        'print_jobs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('session_id', sa.UUID(), nullable=True),
        sa.Column('kiosk_id', sa.UUID(), nullable=False),
        sa.Column('file_path', sa.String(length=1000), nullable=False),
        sa.Column('original_filename', sa.String(length=500), nullable=False),
        sa.Column('pages', sa.Integer(), nullable=False),
        sa.Column('copies', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('color_mode', color_mode, nullable=False, server_default='nb'),
        sa.Column('duplex', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('paper_format', sa.String(length=10), nullable=False, server_default='A4'),
        sa.Column('price_fcfa', sa.Integer(), nullable=True),
        sa.Column('status', print_job_status, nullable=False, server_default='en_creation'),
        sa.Column('withdrawal_code', sa.String(length=4), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['kiosk_id'], ['kiosks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['session_id'], ['sessions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_print_jobs_kiosk_status', 'print_jobs', ['kiosk_id', 'status'])
    op.create_index('idx_print_jobs_status', 'print_jobs', ['status'])

    # payments
    op.create_table(
        'payments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('print_job_id', sa.UUID(), nullable=False),
        sa.Column('provider', payment_provider, nullable=False),
        sa.Column('provider_transaction_id', sa.String(length=255), nullable=True),
        sa.Column('amount_fcfa', sa.Integer(), nullable=False),
        sa.Column('status', payment_status, nullable=False, server_default='initie'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['print_job_id'], ['print_jobs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('print_job_id'),
        sa.UniqueConstraint('provider_transaction_id')
    )
    op.create_index('idx_payments_provider_txn', 'payments', ['provider_transaction_id'])

    # agents
    op.create_table(
        'agents',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('kiosk_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('pin_hash', sa.String(length=60), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['kiosk_id'], ['kiosks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    op.drop_table('agents')
    op.drop_table('payments')
    op.drop_table('print_jobs')
    op.drop_table('sessions')
    op.drop_table('kiosks')
    # Drop enums
    op.execute('DROP TYPE kiosk_status')
    op.execute('DROP TYPE session_status')
    op.execute('DROP TYPE color_mode')
    op.execute('DROP TYPE print_job_status')
    op.execute('DROP TYPE payment_provider')
    op.execute('DROP TYPE payment_status')

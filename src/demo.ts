import type { OperationData } from './domain'

export const demoOperation: OperationData = {
  id: '00000000-0000-0000-0000-000000000001',
  displayId: 'OP-2026-0148',
  version: '1',
  serviceCount: 3,
  totalCents: 482750,
  people: [
    { id: '10000000-0000-0000-0000-000000000001', name: 'Mariana Costa', email: 'mariana.costa@empresa.com.br', phone: '(11) 99999-1001', role: 'Solicitante' },
    { id: '10000000-0000-0000-0000-000000000002', name: 'Carlos Mendes', email: 'carlos.mendes@empresa.com.br', phone: '(11) 99999-1002', role: 'Passageiro' },
    { id: '10000000-0000-0000-0000-000000000003', name: 'Ana Paula Silva', email: '', phone: '(11) 99999-1003', role: 'Passageiro' }
  ],
  directory: [
    { id: '10000000-0000-0000-0000-000000000001', name: 'Mariana Costa', email: 'mariana.costa@empresa.com.br', phone: '(11) 99999-1001', role: 'Solicitante' },
    { id: '10000000-0000-0000-0000-000000000002', name: 'Carlos Mendes', email: 'carlos.mendes@empresa.com.br', phone: '(11) 99999-1002', role: 'Passageiro' },
    { id: '10000000-0000-0000-0000-000000000003', name: 'Ana Paula Silva', email: '', phone: '(11) 99999-1003', role: 'Passageiro' },
    { id: 'db6ca105-4bdb-4bd1-8fb5-7561ebf9aa11', name: 'João Lima', email: 'joao.lima@empresa.com', phone: '(11) 99999-1111', role: 'Adicionado' },
    { id: 'db6ca105-4bdb-4bd1-8fb5-7561ebf9aa12', name: 'Fernanda Moraes', email: 'fernanda.moraes@empresa.com', phone: '(11) 99999-1112', role: 'Adicionado' }
  ],
  payers: []
}

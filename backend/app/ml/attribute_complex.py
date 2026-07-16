from __future__ import annotations

import torch

from torch import nn


class AttributeEnhancedComplEx(
    nn.Module
):
    def __init__(
            self,
            num_entities: int,
            num_relations: int,
            num_types: int,
            attribute_dim: int,
            complex_dim: int,
            attribute_hidden_dim: int,
            dropout: float,
    ) -> None:
        super().__init__()

        self.complex_dim = (
            complex_dim
        )

        representation_dim = (
                2 * complex_dim
        )

        self.entity_embedding = (
            nn.Embedding(
                num_entities,
                representation_dim,
            )
        )

        self.relation_embedding = (
            nn.Embedding(
                num_relations,
                representation_dim,
            )
        )

        self.type_embedding = (
            nn.Embedding(
                num_types,
                representation_dim,
            )
        )

        self.attribute_encoder = (
            nn.Sequential(
                nn.Linear(
                    attribute_dim,
                    attribute_hidden_dim,
                ),

                nn.ReLU(),

                nn.Dropout(
                    dropout
                ),

                nn.Linear(
                    attribute_hidden_dim,
                    representation_dim,
                ),
            )
        )

        self.gate = nn.Linear(
            2 * representation_dim,
            representation_dim,
            )

        self.output_norm = (
            nn.LayerNorm(
                representation_dim
            )
        )

        self.dropout = nn.Dropout(
            dropout
        )

        self.reset_parameters()

    def reset_parameters(
            self
    ) -> None:
        nn.init.xavier_uniform_(
            self.entity_embedding.weight
        )

        nn.init.xavier_uniform_(
            self.relation_embedding.weight
        )

        nn.init.xavier_uniform_(
            self.type_embedding.weight
        )

        for module in (
                self.attribute_encoder
        ):
            if isinstance(
                    module,
                    nn.Linear,
            ):
                nn.init.xavier_uniform_(
                    module.weight
                )

                nn.init.zeros_(
                    module.bias
                )

        nn.init.xavier_uniform_(
            self.gate.weight
        )

        nn.init.zeros_(
            self.gate.bias
        )

        self.output_norm.reset_parameters()

    def entity_representation(
            self,
            entity_ids: torch.Tensor,
            attribute_features:
            torch.Tensor,
            type_ids: torch.Tensor,
    ) -> torch.Tensor:
        structural = (
                self.entity_embedding(
                    entity_ids
                )
                + self.type_embedding(
            type_ids
        )
        )

        literal = (
            self.attribute_encoder(
                attribute_features
            )
        )

        gate = torch.sigmoid(
            self.gate(
                torch.cat(
                    [
                        structural,
                        literal,
                    ],
                    dim=-1,
                )
            )
        )

        fused = (
                gate * structural
                + (1.0 - gate) * literal
        )

        return self.output_norm(
            self.dropout(fused)
        )

    def score(
            self,
            head_ids: torch.Tensor,
            relation_ids: torch.Tensor,
            tail_ids: torch.Tensor,
            head_attributes:
            torch.Tensor,
            tail_attributes:
            torch.Tensor,
            head_type_ids:
            torch.Tensor,
            tail_type_ids:
            torch.Tensor,
    ) -> torch.Tensor:
        head = self.entity_representation(
            head_ids,
            head_attributes,
            head_type_ids,
        )

        tail = self.entity_representation(
            tail_ids,
            tail_attributes,
            tail_type_ids,
        )

        relation = (
            self.relation_embedding(
                relation_ids
            )
        )

        head_real, head_imaginary = (
            head.chunk(
                2,
                dim=-1,
            )
        )

        (
            relation_real,
            relation_imaginary,
        ) = relation.chunk(
            2,
            dim=-1,
        )

        tail_real, tail_imaginary = (
            tail.chunk(
                2,
                dim=-1,
            )
        )

        score = (
                head_real
                * relation_real
                * tail_real

                + head_imaginary
                * relation_real
                * tail_imaginary

                + head_real
                * relation_imaginary
                * tail_imaginary

                - head_imaginary
                * relation_imaginary
                * tail_real
        )

        return score.sum(
            dim=-1
        )